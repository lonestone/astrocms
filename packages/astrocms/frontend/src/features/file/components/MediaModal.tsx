import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { MdMoreHoriz } from 'react-icons/md'
import { FiUpload } from 'react-icons/fi'
import { useFiles, type FileActionKind } from '../contexts/FilesContext.js'
import { useAssetsTree } from '../hooks/useAssetsTree.js'
import { uploadMedia, type MediaRoot, type TreeNode } from '../../../api.js'
import Button from '../../common/components/Button.js'
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
    <div
      className="fixed inset-0 z-10000 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Select media</span>
            <span className="text-sm text-gray-400">{breadcrumb}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
            >
              <FiUpload className="inline -mt-px mr-1" />
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={onClose}
              className="bg-transparent border-none text-lg cursor-pointer text-gray-400 leading-none px-1 hover:text-gray-600"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>

        <TabBar tabs={tabs} active={activeTab} onSelect={handleTab} />

        {/* Navigation */}
        {canGoUp && (
          <div className="px-4 pt-2">
            <button
              onClick={handleParent}
              className="bg-transparent border-none cursor-pointer text-primary text-sm p-0 hover:underline"
            >
              &larr; Parent directory
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 pt-2 pb-4">
          {/* Directories */}
          {directories.length > 0 && (
            <div className="mb-3">
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
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer text-sm hover:bg-gray-100"
                >
                  <span className="text-sm">&#x1F4C1;</span>
                  {entry.name}
                </div>
              ))}
            </div>
          )}

          {/* Media files grid */}
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
                  className="group relative border border-border rounded p-1 cursor-pointer flex flex-col items-center gap-1 hover:border-primary"
                >
                  <button
                    type="button"
                    aria-label="Actions"
                    title="Actions"
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect()
                      openEntryMenu(entry, rect.right, rect.bottom)
                    }}
                    className="absolute top-1 right-1 w-5 h-5 rounded bg-white/80 text-text-muted hover:bg-white opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center shadow-sm"
                  >
                    <MdMoreHoriz className="w-4 h-4" />
                  </button>
                  <img
                    src={previewUrl(entry)}
                    alt={entry.name}
                    className="w-full h-20 object-contain bg-bg rounded-sm"
                  />
                  <span
                    className="text-xs leading-tight text-gray-400 text-center overflow-hidden text-ellipsis whitespace-nowrap w-full"
                    title={entry.name}
                  >
                    {entry.name}
                  </span>
                </div>
              ))}
            </div>
          ) : directories.length === 0 ? (
            <div className="text-gray-400 p-4 text-center text-sm">
              No media files in this directory
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
