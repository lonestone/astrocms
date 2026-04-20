import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  MdDriveFileRenameOutline,
  MdContentCopy,
  MdDriveFileMoveOutline,
  MdDeleteOutline,
  MdNoteAdd,
  MdCreateNewFolder,
} from 'react-icons/md'
import type { TreeNode } from '../../../api.js'
import { useTree } from '../../sidebar/hooks/useTree.js'
import { useFileOps } from '../hooks/useFileOps.js'
import { ActionsMenu, type ActionItem } from '../components/ActionsMenu.js'
import { PromptDialog, type LangHint } from '../components/PromptDialog.js'
import { MoveDialog } from '../components/MoveDialog.js'
import { ConfirmDialog } from '../components/ConfirmDialog.js'

export type FileActionKind =
  | 'new-file'
  | 'new-folder'
  | 'rename'
  | 'duplicate'
  | 'move'
  | 'delete'

export interface OpenMenuOpts {
  actions?: FileActionKind[]
  extras?: ActionItem[]
  /** If set, replaces the default rename-dialog behavior for the 'rename' action. */
  renameOverride?: (node: TreeNode) => void
  onAfterRename?: (newPath: string) => void
  onAfterDuplicate?: (newPath: string) => void
  onAfterMove?: (newPath: string) => void
  onAfterDelete?: (path: string) => void
  onAfterCreate?: (newPath: string) => void
  resolveLangHint?: (kind: 'duplicate' | 'new-file') => LangHint | undefined
}

export interface DirectActionOpts {
  onAfter?: (result: string) => void
  langHint?: LangHint
}

export interface CreateFileOpts {
  folderPath: string
  langHint?: LangHint
  onAfterCreate?: (newPath: string) => void
}

export interface CreateFolderOpts {
  folderPath: string
  onAfterCreate?: (newPath: string) => void
}

interface FilesContextValue {
  tree: TreeNode[]
  invalidateTree: () => void
  /** Invalidate every file-related query (tree + open file contents + git). */
  invalidateFiles: () => void
  openMenu: (
    node: TreeNode,
    x: number,
    y: number,
    opts?: OpenMenuOpts
  ) => void
  rename: (node: TreeNode, opts?: DirectActionOpts) => void
  duplicate: (node: TreeNode, opts?: DirectActionOpts) => void
  move: (node: TreeNode, opts?: DirectActionOpts) => void
  remove: (node: TreeNode, opts?: DirectActionOpts) => void
  createFile: (opts: CreateFileOpts) => void
  createFolder: (opts: CreateFolderOpts) => void
}

const FilesContext = createContext<FilesContextValue | null>(null)

export function useFiles(): FilesContextValue {
  const ctx = useContext(FilesContext)
  if (!ctx) throw new Error('useFiles must be used within FilesProvider')
  return ctx
}

type MenuState = {
  node: TreeNode
  x: number
  y: number
  opts?: OpenMenuOpts
} | null

type DialogState =
  | { kind: 'rename'; node: TreeNode; onAfter?: (newPath: string) => void }
  | {
      kind: 'duplicate'
      node: TreeNode
      onAfter?: (newPath: string) => void
      langHint?: LangHint
    }
  | { kind: 'move'; node: TreeNode; onAfter?: (newPath: string) => void }
  | { kind: 'delete'; node: TreeNode; onAfter?: (path: string) => void }
  | {
      kind: 'create-file'
      folderPath: string
      onAfter?: (newPath: string) => void
      langHint?: LangHint
    }
  | {
      kind: 'create-folder'
      folderPath: string
      onAfter?: (newPath: string) => void
    }
  | null

function parentOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
}

function suggestDuplicateName(node: TreeNode): string {
  if (node.type === 'directory') return `${node.name}-copy`
  const ext = node.name.match(/\.[^.]+$/)?.[0] ?? ''
  const base = node.name.slice(0, node.name.length - ext.length)
  return `${base}-copy${ext}`
}

function containingFolder(node: TreeNode): string {
  return node.type === 'directory' ? node.path : parentOf(node.path)
}

export function FilesProvider({ children }: { children: React.ReactNode }) {
  const { tree, invalidateTree } = useTree()
  const fileOps = useFileOps()
  const queryClient = useQueryClient()
  const [menu, setMenu] = useState<MenuState>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  const invalidateFiles = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tree'] })
    queryClient.invalidateQueries({ queryKey: ['file'] })
    queryClient.invalidateQueries({ queryKey: ['folderMeta'] })
    queryClient.invalidateQueries({ queryKey: ['gitStatus'] })
  }, [queryClient])

  const openMenu = useCallback(
    (node: TreeNode, x: number, y: number, opts?: OpenMenuOpts) => {
      setMenu({ node, x, y, opts })
    },
    []
  )

  const rename = useCallback((node: TreeNode, opts?: DirectActionOpts) => {
    setDialog({ kind: 'rename', node, onAfter: opts?.onAfter })
  }, [])

  const duplicate = useCallback((node: TreeNode, opts?: DirectActionOpts) => {
    setDialog({
      kind: 'duplicate',
      node,
      onAfter: opts?.onAfter,
      langHint: opts?.langHint,
    })
  }, [])

  const move = useCallback((node: TreeNode, opts?: DirectActionOpts) => {
    setDialog({ kind: 'move', node, onAfter: opts?.onAfter })
  }, [])

  const remove = useCallback((node: TreeNode, opts?: DirectActionOpts) => {
    setDialog({ kind: 'delete', node, onAfter: opts?.onAfter })
  }, [])

  const createFile = useCallback((opts: CreateFileOpts) => {
    setDialog({
      kind: 'create-file',
      folderPath: opts.folderPath,
      onAfter: opts.onAfterCreate,
      langHint: opts.langHint,
    })
  }, [])

  const createFolder = useCallback((opts: CreateFolderOpts) => {
    setDialog({
      kind: 'create-folder',
      folderPath: opts.folderPath,
      onAfter: opts.onAfterCreate,
    })
  }, [])

  function buildMenuItems(
    node: TreeNode,
    opts: OpenMenuOpts | undefined
  ): ActionItem[] {
    const kinds = opts?.actions ?? ['rename', 'duplicate', 'move', 'delete']
    const items: ActionItem[] = []
    for (const kind of kinds) {
      switch (kind) {
        case 'new-file':
          items.push({
            label: 'New file',
            icon: <MdNoteAdd className="w-3.5 h-3.5" />,
            onClick: () =>
              createFile({
                folderPath: containingFolder(node),
                onAfterCreate: opts?.onAfterCreate,
                langHint: opts?.resolveLangHint?.('new-file'),
              }),
          })
          break
        case 'new-folder':
          items.push({
            label: 'New folder',
            icon: <MdCreateNewFolder className="w-3.5 h-3.5" />,
            onClick: () =>
              createFolder({
                folderPath: containingFolder(node),
                onAfterCreate: opts?.onAfterCreate,
              }),
          })
          break
        case 'rename':
          items.push({
            label: 'Rename',
            icon: <MdDriveFileRenameOutline className="w-3.5 h-3.5" />,
            onClick: () => {
              if (opts?.renameOverride) opts.renameOverride(node)
              else rename(node, { onAfter: opts?.onAfterRename })
            },
          })
          break
        case 'duplicate':
          items.push({
            label: 'Duplicate',
            icon: <MdContentCopy className="w-3.5 h-3.5" />,
            onClick: () =>
              duplicate(node, {
                onAfter: opts?.onAfterDuplicate,
                langHint: opts?.resolveLangHint?.('duplicate'),
              }),
          })
          break
        case 'move':
          items.push({
            label: 'Move',
            icon: <MdDriveFileMoveOutline className="w-3.5 h-3.5" />,
            onClick: () => move(node, { onAfter: opts?.onAfterMove }),
          })
          break
        case 'delete':
          items.push({
            label: 'Delete',
            danger: true,
            icon: <MdDeleteOutline className="w-3.5 h-3.5" />,
            onClick: () => remove(node, { onAfter: opts?.onAfterDelete }),
          })
          break
      }
    }
    if (opts?.extras) items.push(...opts.extras)
    return items
  }

  async function handleRenameConfirm(newName: string) {
    if (dialog?.kind !== 'rename') return
    const node = dialog.node
    const trimmed = newName.trim()
    if (!trimmed || trimmed === node.name) {
      setDialog(null)
      return
    }
    const parent = parentOf(node.path)
    const to = parent ? `${parent}/${trimmed}` : trimmed
    await fileOps.rename.mutateAsync({ from: node.path, to })
    dialog.onAfter?.(to)
    setDialog(null)
  }

  async function handleDuplicateConfirm(newName: string) {
    if (dialog?.kind !== 'duplicate') return
    const node = dialog.node
    const parent = parentOf(node.path)
    const to = parent ? `${parent}/${newName}` : newName
    await fileOps.duplicate.mutateAsync({ from: node.path, to })
    dialog.onAfter?.(to)
    setDialog(null)
  }

  async function handleMoveConfirm(destFolder: string) {
    if (dialog?.kind !== 'move') return
    const node = dialog.node
    const to = destFolder ? `${destFolder}/${node.name}` : node.name
    if (to === node.path) {
      setDialog(null)
      return
    }
    await fileOps.rename.mutateAsync({ from: node.path, to })
    dialog.onAfter?.(to)
    setDialog(null)
  }

  async function handleDeleteConfirm() {
    if (dialog?.kind !== 'delete') return
    const node = dialog.node
    await fileOps.remove.mutateAsync({ path: node.path })
    dialog.onAfter?.(node.path)
    setDialog(null)
  }

  async function handleCreateFileConfirm(name: string) {
    if (dialog?.kind !== 'create-file') return
    const finalName = name.includes('.') ? name : `${name}.mdx`
    const path = dialog.folderPath
      ? `${dialog.folderPath}/${finalName}`
      : finalName
    await fileOps.create.mutateAsync({ path })
    dialog.onAfter?.(path)
    setDialog(null)
  }

  async function handleCreateFolderConfirm(folderName: string) {
    if (dialog?.kind !== 'create-folder') return
    const name = folderName.trim().replace(/^\/+|\/+$/g, '')
    if (!name) {
      setDialog(null)
      return
    }
    const indexPath = dialog.folderPath
      ? `${dialog.folderPath}/${name}/index.mdx`
      : `${name}/index.mdx`
    await fileOps.create.mutateAsync({ path: indexPath })
    dialog.onAfter?.(indexPath)
    setDialog(null)
  }

  const value = useMemo<FilesContextValue>(
    () => ({
      tree,
      invalidateTree,
      invalidateFiles,
      openMenu,
      rename,
      duplicate,
      move,
      remove,
      createFile,
      createFolder,
    }),
    [
      tree,
      invalidateTree,
      invalidateFiles,
      openMenu,
      rename,
      duplicate,
      move,
      remove,
      createFile,
      createFolder,
    ]
  )

  return (
    <FilesContext.Provider value={value}>
      {children}

      {menu && (
        <ActionsMenu
          items={buildMenuItems(menu.node, menu.opts)}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}

      {dialog?.kind === 'rename' && (
        <PromptDialog
          title={`Rename ${dialog.node.name}`}
          label="New name"
          initialValue={dialog.node.name}
          confirmLabel="Rename"
          onCancel={() => setDialog(null)}
          onConfirm={handleRenameConfirm}
        />
      )}
      {dialog?.kind === 'duplicate' && (
        <PromptDialog
          title={`Duplicate ${dialog.node.name}`}
          label="New name"
          initialValue={suggestDuplicateName(dialog.node)}
          confirmLabel="Duplicate"
          onCancel={() => setDialog(null)}
          onConfirm={handleDuplicateConfirm}
          langHint={dialog.langHint}
        />
      )}
      {dialog?.kind === 'move' && (
        <MoveDialog
          node={dialog.node}
          onCancel={() => setDialog(null)}
          onConfirm={handleMoveConfirm}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${dialog.node.name}?`}
          message={
            dialog.node.type === 'directory'
              ? `This will permanently delete the folder "${dialog.node.path}" and all of its contents.`
              : `This will permanently delete "${dialog.node.path}".`
          }
          confirmLabel="Delete"
          confirmVariant="danger"
          onCancel={() => setDialog(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
      {dialog?.kind === 'create-file' && (
        <PromptDialog
          title={
            dialog.folderPath ? `New file in ${dialog.folderPath}` : 'New file'
          }
          label="Filename"
          initialValue="new-file.mdx"
          confirmLabel="Create"
          onCancel={() => setDialog(null)}
          onConfirm={handleCreateFileConfirm}
          langHint={dialog.langHint}
        />
      )}
      {dialog?.kind === 'create-folder' && (
        <PromptDialog
          title={
            dialog.folderPath
              ? `New folder in ${dialog.folderPath}`
              : 'New folder'
          }
          label="Folder name"
          initialValue="new-folder"
          confirmLabel="Create"
          description="An index.mdx will be created inside so the folder shows up."
          onCancel={() => setDialog(null)}
          onConfirm={handleCreateFolderConfirm}
        />
      )}
    </FilesContext.Provider>
  )
}
