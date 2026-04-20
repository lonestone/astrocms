import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import {
  MdMoreHoriz,
  MdDriveFileRenameOutline,
  MdDriveFileMoveOutline,
  MdDeleteOutline,
} from 'react-icons/md'
import { useTree } from '../../sidebar/hooks/useTree.js'
import { useFileOps } from '../hooks/useFileOps.js'
import { ActionsMenu, type ActionItem } from './ActionsMenu.js'
import { PromptDialog } from './PromptDialog.js'
import { MoveDialog } from './MoveDialog.js'
import { ConfirmDialog } from './ConfirmDialog.js'
import { uploadMedia, type TreeNode } from '../../../api.js'
import Button from '../../common/components/Button.js'
import { FiUpload } from 'react-icons/fi'

// ---------------------------------------------------------------------------
// Context for opening the media modal from anywhere
// ---------------------------------------------------------------------------

interface MediaModalRequest {
  /** Directory to open in, relative to content dir (e.g. "blog/my-post") */
  initialDir: string
  /** Path of the MDX file being edited, used to compute relative paths */
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
          initialDir={request.initialDir}
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

/** Find a subtree node by its path */
function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNode(node.children, path)
      if (found) return found
    }
  }
  return undefined
}

/** Compute relative path from a file to a target entry */
function computeRelativePath(
  filePath: string,
  entryPath: string,
  entryName: string
): string {
  const fileDir = filePath.replace(/\/[^/]+$/, '')
  const entryDir = entryPath.replace(/\/[^/]+$/, '')

  if (fileDir === entryDir) {
    return `./${entryName}`
  }

  const fileParts = fileDir.split('/')
  const entryParts = entryPath.split('/')

  let common = 0
  while (
    common < fileParts.length &&
    common < entryParts.length &&
    fileParts[common] === entryParts[common]
  ) {
    common++
  }

  const ups = fileParts.length - common
  const rest = entryParts.slice(common).join('/')
  const prefix = ups > 0 ? '../'.repeat(ups) : './'
  return prefix + rest
}

// ---------------------------------------------------------------------------
// Modal overlay
// ---------------------------------------------------------------------------

interface MediaModalOverlayProps {
  initialDir: string
  filePath: string
  onSelect: (relativePath: string) => void
  onClose: () => void
}

function MediaModalOverlay({
  initialDir,
  filePath,
  onSelect,
  onClose,
}: MediaModalOverlayProps) {
  const [currentDir, setCurrentDir] = useState(initialDir)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { tree, invalidateTree } = useTree()
  const fileOps = useFileOps()

  const [menu, setMenu] = useState<{
    entry: TreeNode
    x: number
    y: number
  } | null>(null)
  const [dialog, setDialog] = useState<
    | { kind: 'rename'; entry: TreeNode }
    | { kind: 'move'; entry: TreeNode }
    | { kind: 'delete'; entry: TreeNode }
    | null
  >(null)

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

  // Close on Escape, unless a sub-menu or dialog is open (it handles its own).
  useEffect(() => {
    if (menu || dialog) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, menu, dialog])

  const handleNavigate = useCallback((path: string) => {
    setCurrentDir(path)
  }, [])

  const handleParent = useCallback(() => {
    const parent = currentDir.includes('/')
      ? currentDir.replace(/\/[^/]+$/, '')
      : ''
    setCurrentDir(parent)
  }, [currentDir])

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      await uploadMedia(file, currentDir)
      invalidateTree()
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [currentDir, invalidateTree]
  )

  const handleSelectEntry = useCallback(
    (entry: TreeNode) => {
      onSelect(computeRelativePath(filePath, entry.path, entry.name))
    },
    [filePath, onSelect]
  )

  const buildMenuItems = useCallback(
    (entry: TreeNode): ActionItem[] => [
      {
        label: 'Rename',
        icon: <MdDriveFileRenameOutline className="w-3.5 h-3.5" />,
        onClick: () => setDialog({ kind: 'rename', entry }),
      },
      {
        label: 'Move',
        icon: <MdDriveFileMoveOutline className="w-3.5 h-3.5" />,
        onClick: () => setDialog({ kind: 'move', entry }),
      },
      {
        label: 'Delete',
        danger: true,
        icon: <MdDeleteOutline className="w-3.5 h-3.5" />,
        onClick: () => setDialog({ kind: 'delete', entry }),
      },
    ],
    []
  )

  async function handleRename(entry: TreeNode, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === entry.name) {
      setDialog(null)
      return
    }
    const parent = entry.path.includes('/')
      ? entry.path.slice(0, entry.path.lastIndexOf('/'))
      : ''
    const to = parent ? `${parent}/${trimmed}` : trimmed
    await fileOps.rename.mutateAsync({ from: entry.path, to })
    setDialog(null)
  }

  async function handleMove(entry: TreeNode, destFolder: string) {
    const to = destFolder ? `${destFolder}/${entry.name}` : entry.name
    if (to === entry.path) {
      setDialog(null)
      return
    }
    await fileOps.rename.mutateAsync({ from: entry.path, to })
    setDialog(null)
  }

  async function handleDelete(entry: TreeNode) {
    await fileOps.remove.mutateAsync({ path: entry.path })
    setDialog(null)
  }

  const canGoUp = currentDir !== ''

  const previewUrl = (entry: TreeNode) => `/astrocms/content/${entry.path}`

  const breadcrumb = currentDir || '/'

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
                    setMenu({ entry, x: e.clientX, y: e.clientY })
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
                      setMenu({ entry, x: rect.right, y: rect.bottom })
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

      {menu && (
        <ActionsMenu
          items={buildMenuItems(menu.entry)}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}

      {dialog?.kind === 'rename' && (
        <PromptDialog
          title={`Rename ${dialog.entry.name}`}
          label="New name"
          initialValue={dialog.entry.name}
          confirmLabel="Rename"
          onCancel={() => setDialog(null)}
          onConfirm={(name) => handleRename(dialog.entry, name)}
        />
      )}
      {dialog?.kind === 'move' && (
        <MoveDialog
          node={dialog.entry}
          tree={tree}
          onCancel={() => setDialog(null)}
          onConfirm={(destFolder) => handleMove(dialog.entry, destFolder)}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${dialog.entry.name}?`}
          message={`This will permanently delete "${dialog.entry.path}".`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onCancel={() => setDialog(null)}
          onConfirm={() => handleDelete(dialog.entry)}
        />
      )}
    </div>
  )
}
