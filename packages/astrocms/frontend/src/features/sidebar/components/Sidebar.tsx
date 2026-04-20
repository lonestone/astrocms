import React, { useCallback, useMemo, useState } from 'react'
import {
  MdDriveFileRenameOutline,
  MdContentCopy,
  MdDeleteOutline,
  MdNoteAdd,
  MdCreateNewFolder,
  MdDriveFileMoveOutline,
} from 'react-icons/md'
import { useLocation, useNavigate } from 'react-router'
import type { TreeNode, FrontmatterFieldSchema } from '../../../api.js'
import { getCollectionFolderPaths } from '../../common/utils/collections.js'
import { useResizablePanel } from '../../common/hooks/useResizablePanel.js'
import { ResizeHandle } from '../../common/components/ResizeHandle.js'
import { useCollections } from '../hooks/useCollections.js'
import { useFileOps } from '../../file/hooks/useFileOps.js'
import { useOpenFolders } from '../hooks/useOpenFolders.js'
import { filterTree } from '../utils/filterTree.js'
import { ActionsMenu, type ActionItem } from '../../file/components/ActionsMenu.js'
import { ConfirmDialog } from '../../file/components/ConfirmDialog.js'
import { MoveDialog } from '../../file/components/MoveDialog.js'
import { PromptDialog } from '../../file/components/PromptDialog.js'
import {
  extOf,
  isLocaleFilename,
  usedLangsInFolder,
} from '../../file/utils/localeFiles.js'
import { SidebarSearch } from './SidebarSearch.js'
import { SortMenuWrapper } from './SortMenuWrapper.js'
import { TreeItem } from './TreeItem.js'

type DialogState =
  | { kind: 'create-file'; folderPath: string }
  | { kind: 'create-folder'; folderPath: string }
  | { kind: 'duplicate'; node: TreeNode }
  | { kind: 'move'; node: TreeNode }
  | { kind: 'delete'; node: TreeNode }
  | null

type MenuState =
  | { kind: 'actions'; node: TreeNode; x: number; y: number }
  | { kind: 'sort'; folderPath: string; x: number; y: number }
  | null

interface Props {
  tree: TreeNode[]
  onSelectFile: (path: string) => void
}

export function Sidebar({ tree, onSelectFile }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const selectedFile = location.pathname.startsWith('/edit/')
    ? decodeURIComponent(location.pathname.slice('/edit/'.length))
    : null

  const { openFolders, toggleFolder } = useOpenFolders(selectedFile)

  const { width, handleMouseDown } = useResizablePanel({
    storageKey: 'cms-sidebar-width',
    defaultWidth: 260,
    minWidth: 150,
    maxWidth: 500,
    side: 'right',
  })

  const { data: collectionsData } = useCollections()
  const collections = collectionsData?.collections ?? {}

  const [dialog, setDialog] = useState<DialogState>(null)
  const [menu, setMenu] = useState<MenuState>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const fileOps = useFileOps()

  const filtered = useMemo(() => filterTree(tree, query), [tree, query])
  const searching = query.trim().length > 0
  const effectiveOpen = searching ? filtered.expand : openFolders

  function getSchemaForFolder(
    folderPath: string
  ): FrontmatterFieldSchema[] | undefined {
    for (const [name, info] of Object.entries(collections)) {
      if (info.loader === 'file') continue
      const folder = info.base ?? name
      if (folder === folderPath) return info.schema ?? undefined
    }
    return undefined
  }

  const collectionFolderPaths = useMemo(
    () => getCollectionFolderPaths(collections),
    [collections]
  )

  /** True when `path` is a collection root (glob base or fallback name). */
  const isCollectionFolder = useCallback(
    (path: string) => collectionFolderPaths.has(path),
    [collectionFolderPaths]
  )

  function openActionsMenu(node: TreeNode, x: number, y: number) {
    setMenu({ kind: 'actions', node, x, y })
  }
  function openSortMenu(folderPath: string, x: number, y: number) {
    setMenu({ kind: 'sort', folderPath, x, y })
  }

  function getContainingFolder(node: TreeNode): string {
    if (node.type === 'directory') return node.path
    return node.path.includes('/')
      ? node.path.slice(0, node.path.lastIndexOf('/'))
      : ''
  }

  function buildActionsItems(node: TreeNode): ActionItem[] {
    const containingFolder = getContainingFolder(node)
    const locked = isCollectionFolder(node.path)
    const items: ActionItem[] = [
      {
        label: 'New file',
        icon: <MdNoteAdd className="w-3.5 h-3.5" />,
        onClick: () =>
          setDialog({ kind: 'create-file', folderPath: containingFolder }),
      },
      {
        label: 'New folder',
        icon: <MdCreateNewFolder className="w-3.5 h-3.5" />,
        onClick: () =>
          setDialog({ kind: 'create-folder', folderPath: containingFolder }),
      },
    ]
    if (locked) return items
    items.push(
      {
        label: 'Rename',
        icon: <MdDriveFileRenameOutline className="w-3.5 h-3.5" />,
        onClick: () => setRenamingPath(node.path),
      },
      {
        label: 'Duplicate',
        icon: <MdContentCopy className="w-3.5 h-3.5" />,
        onClick: () => setDialog({ kind: 'duplicate', node }),
      },
      {
        label: 'Move',
        icon: <MdDriveFileMoveOutline className="w-3.5 h-3.5" />,
        onClick: () => setDialog({ kind: 'move', node }),
      },
      {
        label: 'Delete',
        danger: true,
        icon: <MdDeleteOutline className="w-3.5 h-3.5" />,
        onClick: () => setDialog({ kind: 'delete', node }),
      }
    )
    return items
  }

  async function handleCreateFile(folderPath: string, name: string) {
    const finalName = name.includes('.') ? name : `${name}.mdx`
    const path = folderPath ? `${folderPath}/${finalName}` : finalName
    await fileOps.create.mutateAsync({ path })
    setDialog(null)
    navigate(`/edit/${path}`)
  }

  async function handleCreateFolder(parentPath: string, folderName: string) {
    const name = folderName.trim().replace(/^\/+|\/+$/g, '')
    if (!name) {
      setDialog(null)
      return
    }
    // Seed with an empty index.mdx so the folder shows up in the tree and is
    // immediately editable.
    const indexPath = parentPath
      ? `${parentPath}/${name}/index.mdx`
      : `${name}/index.mdx`
    await fileOps.create.mutateAsync({ path: indexPath })
    setDialog(null)
    navigate(`/edit/${indexPath}`)
  }

  async function handleMove(node: TreeNode, destFolder: string) {
    const to = destFolder ? `${destFolder}/${node.name}` : node.name
    if (to === node.path) {
      setDialog(null)
      return
    }
    await fileOps.rename.mutateAsync({ from: node.path, to })
    setDialog(null)
    if (node.type === 'file' && selectedFile === node.path) {
      navigate(`/edit/${to}`)
    } else if (
      node.type === 'directory' &&
      selectedFile?.startsWith(node.path + '/')
    ) {
      navigate(`/edit/${to}${selectedFile.slice(node.path.length)}`)
    }
  }

  async function handleRename(node: TreeNode, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === node.name) {
      setRenamingPath(null)
      return
    }
    const parent = node.path.includes('/')
      ? node.path.slice(0, node.path.lastIndexOf('/'))
      : ''
    const to = parent ? `${parent}/${trimmed}` : trimmed
    await fileOps.rename.mutateAsync({ from: node.path, to })
    setRenamingPath(null)
    if (node.type === 'file' && selectedFile === node.path) {
      navigate(`/edit/${to}`)
    } else if (
      node.type === 'directory' &&
      selectedFile?.startsWith(node.path + '/')
    ) {
      navigate(`/edit/${to}${selectedFile.slice(node.path.length)}`)
    }
  }

  async function handleDuplicate(node: TreeNode, newName: string) {
    const parent = node.path.includes('/')
      ? node.path.slice(0, node.path.lastIndexOf('/'))
      : ''
    const to = parent ? `${parent}/${newName}` : newName
    await fileOps.duplicate.mutateAsync({ from: node.path, to })
    setDialog(null)
    if (node.type === 'file') {
      navigate(`/edit/${to}`)
    }
  }

  async function handleDelete(node: TreeNode) {
    await fileOps.remove.mutateAsync({ path: node.path })
    setDialog(null)
    if (node.type === 'file' && selectedFile === node.path) {
      navigate('/')
    } else if (
      node.type === 'directory' &&
      selectedFile?.startsWith(node.path + '/')
    ) {
      navigate('/')
    }
  }

  function suggestDuplicateName(node: TreeNode): string {
    if (node.type === 'directory') return `${node.name}-copy`
    const ext = node.name.match(/\.[^.]+$/)?.[0] ?? ''
    const base = node.name.slice(0, node.name.length - ext.length)
    return `${base}-copy${ext}`
  }

  return (
    <>
      <aside
        style={{ width }}
        className="bg-bg-panel overflow-auto shrink-0 text-sm"
      >
        <SidebarSearch query={query} onChange={setQuery} />
        <div className="pb-3 pt-1">
          {searching && filtered.nodes.length === 0 && (
            <div className="px-3 py-2 text-text-muted">No results</div>
          )}
          {filtered.nodes.map((node) => (
            <TreeItem
              key={node.path}
              node={node}
              depth={0}
              selectedFile={selectedFile}
              openFolders={effectiveOpen}
              onToggleFolder={toggleFolder}
              onSelectFile={onSelectFile}
              getSchemaForFolder={getSchemaForFolder}
              onOpenActionsMenu={openActionsMenu}
              onOpenSortMenu={openSortMenu}
              onRequestCreateFile={(folderPath) =>
                setDialog({ kind: 'create-file', folderPath })
              }
              renamingPath={renamingPath}
              onStartRename={(path) => setRenamingPath(path)}
              onSubmitRename={handleRename}
              onCancelRename={() => setRenamingPath(null)}
              isCollectionFolder={isCollectionFolder}
              searching={searching}
            />
          ))}
        </div>
      </aside>
      <ResizeHandle side="right" onMouseDown={handleMouseDown} />

      {menu?.kind === 'actions' && (
        <ActionsMenu
          items={buildActionsItems(menu.node)}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
      {menu?.kind === 'sort' && (
        <SortMenuWrapper
          folderPath={menu.folderPath}
          schema={getSchemaForFolder(menu.folderPath)}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}

      {dialog?.kind === 'create-file' && (
        <PromptDialog
          title={
            dialog.folderPath
              ? `New file in ${dialog.folderPath}`
              : 'New file'
          }
          label="Filename"
          initialValue="new-file.mdx"
          confirmLabel="Create"
          onCancel={() => setDialog(null)}
          onConfirm={(name) => handleCreateFile(dialog.folderPath, name)}
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
          onConfirm={(name) => handleCreateFolder(dialog.folderPath, name)}
        />
      )}
      {dialog?.kind === 'duplicate' && (
        <PromptDialog
          title={`Duplicate ${dialog.node.name}`}
          label="New name"
          initialValue={suggestDuplicateName(dialog.node)}
          confirmLabel="Duplicate"
          onCancel={() => setDialog(null)}
          onConfirm={(name) => handleDuplicate(dialog.node, name)}
          langHint={
            dialog.node.type === 'file' && isLocaleFilename(dialog.node.name)
              ? {
                  ext: extOf(dialog.node.name),
                  usedLangs: usedLangsInFolder(
                    tree,
                    dialog.node.path.includes('/')
                      ? dialog.node.path.slice(
                          0,
                          dialog.node.path.lastIndexOf('/')
                        )
                      : ''
                  ),
                }
              : undefined
          }
        />
      )}
      {dialog?.kind === 'move' && (
        <MoveDialog
          node={dialog.node}
          tree={tree}
          onCancel={() => setDialog(null)}
          onConfirm={(destFolder) => handleMove(dialog.node, destFolder)}
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
          onConfirm={() => handleDelete(dialog.node)}
        />
      )}
    </>
  )
}
