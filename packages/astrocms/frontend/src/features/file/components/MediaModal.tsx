import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { TbCornerLeftUp, TbDots, TbFolder, TbPhoto, TbUpload } from 'react-icons/tb'
import { useFiles, type FileActionKind } from '../contexts/FilesContext.js'
import { useAssetsTree } from '../hooks/useAssetsTree.js'
import { uploadMedia, type MediaRoot, type TreeNode } from '../../../api.js'
import Button from '../../common/components/Button.js'
import { Dialog } from '../../common/components/Dialog.js'
import { IconButton } from '../../common/components/IconButton.js'
import { TabBar, type TabItem } from '../../common/components/TabBar.js'
import { usePublicConfig } from '../../common/hooks/usePublicConfig.js'
import { findNode } from '../../common/utils/findNode.js'
import {
  DEFAULT_MEDIA_ROOT_DIRS,
  mediaPreviewUrl,
  projectPath,
} from '../../common/utils/mediaRoots.js'
import { parentOf, relativePath } from '../../common/utils/paths.js'

// ---------------------------------------------------------------------------
// Context for opening the media modal from anywhere
// ---------------------------------------------------------------------------

interface MediaModalRequest {
  /**
   * Path of the file being edited, relative to the content dir. The picker
   * opens in its folder and selected paths are computed relative to it.
   */
  filePath: string
  /** Callback with the relative path to the selected media */
  onSelect: (relativePath: string) => void
}

interface MediaModalContextValue {
  openMediaModal: (request: MediaModalRequest) => void
}

export const MediaModalContext = createContext<MediaModalContextValue>({
  openMediaModal: () => {},
})

export function useMediaModal() {
  return useContext(MediaModalContext)
}

// ---------------------------------------------------------------------------
// Provider (wraps the app, renders the modal)
// ---------------------------------------------------------------------------

interface ProviderProps {
  children: React.ReactNode
}

export function MediaModalProvider({ children }: ProviderProps) {
  const [request, setRequest] = useState<MediaModalRequest | null>(null)

  const openMediaModal = useCallback((req: MediaModalRequest) => {
    setRequest(req)
  }, [])

  const handleClose = useCallback(() => setRequest(null), [])

  const handleSelect = useCallback(
    (relativePath: string) => {
      request?.onSelect(relativePath)
      setRequest(null)
    },
    [request]
  )

  return (
    <MediaModalContext.Provider value={{ openMediaModal }}>
      {children}
      {request && (
        <MediaModalOverlay
          filePath={request.filePath}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      )}
    </MediaModalContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|svg|webp|avif|ico)$/i

// ---------------------------------------------------------------------------
// Modal overlay
// ---------------------------------------------------------------------------

interface MediaModalOverlayProps {
  filePath: string
  onSelect: (relativePath: string) => void
  onClose: () => void
}

/** Where the picker currently is: a root and a directory inside it. */
interface Location {
  root: MediaRoot
  dir: string
}

type TabKey = 'current' | 'content' | 'assets'

function MediaModalOverlay({
  filePath,
  onSelect,
  onClose,
}: MediaModalOverlayProps) {
  const fileDir = parentOf(filePath)
  const [{ root, dir: currentDir }, setLocation] = useState<Location>({
    root: 'content',
    dir: fileDir,
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { tree: contentTree, invalidateTree, openMenu } = useFiles()
  const config = usePublicConfig()
  const dirs = config ?? DEFAULT_MEDIA_ROOT_DIRS
  const assetsEnabled = !!config?.assetsDir
  const assetsTree = useAssetsTree(assetsEnabled)
  const tree = root === 'assets' ? assetsTree : contentTree

  // Get children for the current directory.
  // An empty currentDir means root (the tree itself).
  const children = useMemo(() => {
    if (!currentDir) return tree
    const node = findNode(tree, currentDir)
    return node?.children ?? []
  }, [tree, currentDir])
  const directories = children.filter((e) => e.type === 'directory')
  const mediaFiles = children.filter(
    (e) => e.type === 'file' && IMAGE_EXTS.test(e.name)
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleNavigate = useCallback(
    (path: string) => {
      setLocation({ root, dir: path })
    },
    [root]
  )

  const handleParent = useCallback(() => {
    setLocation({ root, dir: parentOf(currentDir) })
  }, [root, currentDir])

  const tabs = useMemo<TabItem<TabKey>[]>(() => {
    const items: TabItem<TabKey>[] = [
      { key: 'current', label: 'Current folder', title: fileDir || '/' },
      { key: 'content', label: 'Content', title: dirs.contentDir },
    ]
    if (assetsEnabled) {
      items.push({ key: 'assets', label: 'Assets', title: dirs.assetsDir! })
    }
    return items
  }, [fileDir, dirs, assetsEnabled])

  const activeTab: TabKey =
    root === 'assets' ? 'assets' : currentDir === fileDir ? 'current' : 'content'

  const handleTab = useCallback(
    (key: TabKey) => {
      if (key === 'assets') setLocation({ root: 'assets', dir: '' })
      else if (key === 'current') setLocation({ root: 'content', dir: fileDir })
      else setLocation({ root: 'content', dir: '' })
    },
    [fileDir]
  )

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const result = await uploadMedia(file, currentDir, root)
      if (!result.ok) {
        window.alert(result.error ?? 'Upload failed')
      }
      invalidateTree()
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [root, currentDir, invalidateTree]
  )

  const handleSelectEntry = useCallback(
    (entry: TreeNode) => {
      onSelect(
        relativePath(
          projectPath(dirs, 'content', filePath),
          projectPath(dirs, root, entry.path)
        )
      )
    },
    [dirs, root, filePath, onSelect]
  )

  function openEntryMenu(entry: TreeNode, x: number, y: number) {
    // Moving relies on the content tree, so the assets root only gets
    // rename and delete.
    const actions: FileActionKind[] =
      root === 'assets' ? ['rename', 'delete'] : ['rename', 'move', 'delete']
    openMenu(entry, x, y, { actions, root })
  }

  const canGoUp = currentDir !== ''

  const previewUrl = (entry: TreeNode) => mediaPreviewUrl(root, entry.path)

  const breadcrumb = projectPath(dirs, root, currentDir)

  return (
    <Dialog
      title="Select media"
      description={breadcrumb}
      onClose={onClose}
      width="lg"
      flush
      className="max-h-[80vh]"
      headerActions={
        <>
          <Button
            variant="primary"
            icon={<TbUpload size={16} />}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </>
      }
    >
      <TabBar tabs={tabs} active={activeTab} onSelect={handleTab} />

      <div className="flex-1 overflow-auto px-5 pt-3 pb-5">
        {canGoUp && (
          <button
            type="button"
            onClick={handleParent}
            className="mb-2 inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-text-secondary cursor-pointer transition-colors hover:bg-surface-hover hover:text-text"
          >
            <TbCornerLeftUp size={16} />
            Parent folder
          </button>
        )}

        {directories.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {directories.map((entry) => (
              <div
                key={entry.path}
                role="button"
                tabIndex={0}
                aria-label={`Open folder ${entry.name}`}
                onClick={() => handleNavigate(entry.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleNavigate(entry.path)
                  }
                }}
                className="flex h-8 items-center gap-2 rounded-md px-2 text-ui text-text cursor-pointer transition-colors hover:bg-surface-hover"
              >
                <TbFolder size={16} className="shrink-0 text-text-secondary" />
                <span className="truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        )}

        {mediaFiles.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
            {mediaFiles.map((entry) => (
              <div
                key={entry.path}
                role="button"
                tabIndex={0}
                aria-label={`Select ${entry.name}`}
                onClick={() => handleSelectEntry(entry)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openEntryMenu(entry, e.clientX, e.clientY)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelectEntry(entry)
                  }
                }}
                className="group relative flex cursor-pointer flex-col gap-1.5 rounded-panel border border-border bg-surface-raised p-1.5 transition-colors hover:border-accent hover:bg-accent-soft"
              >
                <IconButton
                  label="Actions"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect()
                    openEntryMenu(entry, rect.right, rect.bottom)
                  }}
                  className="absolute top-2 right-2 z-10 bg-surface-raised/90 opacity-0 shadow-popover group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <TbDots size={15} />
                </IconButton>
                <div className="flex h-20 items-center justify-center overflow-hidden rounded-md bg-surface-inset">
                  <img
                    src={previewUrl(entry)}
                    alt={entry.name}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span
                  className="w-full truncate px-0.5 text-center text-xs text-text-secondary"
                  title={entry.name}
                >
                  {entry.name}
                </span>
              </div>
            ))}
          </div>
        ) : directories.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-xs text-text-muted">
            <TbPhoto size={22} className="text-text-faint" />
            <span>No images in this folder yet.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload one
            </Button>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
