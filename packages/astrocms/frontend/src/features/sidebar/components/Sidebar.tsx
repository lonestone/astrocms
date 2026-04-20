import React, { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { TreeNode, FrontmatterFieldSchema } from '../../../api.js'
import { getCollectionFolderPaths } from '../../common/utils/collections.js'
import { useResizablePanel } from '../../common/hooks/useResizablePanel.js'
import { ResizeHandle } from '../../common/components/ResizeHandle.js'
import { useCollections } from '../hooks/useCollections.js'
import { useFileOps } from '../../file/hooks/useFileOps.js'
import { useOpenFolders } from '../hooks/useOpenFolders.js'
import { filterTree } from '../utils/filterTree.js'
import {
  useFiles,
  type FileActionKind,
} from '../../file/contexts/FilesContext.js'
import type { LangHint } from '../../file/components/PromptDialog.js'
import {
  extOf,
  firstRemainingLocaleSibling,
  isLocaleFilename,
  usedLangsInFolder,
} from '../../file/utils/localeFiles.js'
import { SortMenuWrapper } from './SortMenuWrapper.js'
import { SidebarSearch } from './SidebarSearch.js'
import { TreeItem } from './TreeItem.js'

type SortMenuState = { folderPath: string; x: number; y: number } | null

interface Props {
  onSelectFile: (path: string) => void
}

export function Sidebar({ onSelectFile }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const files = useFiles()
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

  const [sortMenu, setSortMenu] = useState<SortMenuState>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const fileOps = useFileOps()

  const filtered = useMemo(
    () => filterTree(files.tree, query),
    [files.tree, query]
  )
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

  function openSortMenu(folderPath: string, x: number, y: number) {
    setSortMenu({ folderPath, x, y })
  }

  function followMoveRename(oldPath: string, newPath: string) {
    if (selectedFile === oldPath) {
      navigate(`/edit/${newPath}`)
    } else if (selectedFile?.startsWith(oldPath + '/')) {
      navigate(`/edit/${newPath}${selectedFile.slice(oldPath.length)}`)
    }
  }

  function followDelete(deletedPath: string) {
    if (selectedFile === deletedPath) {
      const next = firstRemainingLocaleSibling(files.tree, deletedPath)
      navigate(next ? `/edit/${next}` : '/')
    } else if (selectedFile?.startsWith(deletedPath + '/')) {
      navigate('/')
    }
  }

  function resolveLangHint(node: TreeNode, kind: 'duplicate' | 'new-file') {
    if (
      kind === 'duplicate' &&
      node.type === 'file' &&
      isLocaleFilename(node.name)
    ) {
      const parent = node.path.includes('/')
        ? node.path.slice(0, node.path.lastIndexOf('/'))
        : ''
      return {
        ext: extOf(node.name),
        usedLangs: usedLangsInFolder(files.tree, parent),
      } satisfies LangHint
    }
    return undefined
  }

  function openActionsMenu(node: TreeNode, x: number, y: number) {
    const locked = isCollectionFolder(node.path)
    const actions: FileActionKind[] = locked
      ? ['new-file', 'new-folder']
      : ['new-file', 'new-folder', 'rename', 'duplicate', 'move', 'delete']
    files.openMenu(node, x, y, {
      actions,
      renameOverride: (n) => setRenamingPath(n.path),
      onAfterDuplicate: (newPath) => {
        if (node.type === 'file') navigate(`/edit/${newPath}`)
      },
      onAfterMove: (newPath) => followMoveRename(node.path, newPath),
      onAfterDelete: followDelete,
      onAfterCreate: (newPath) => navigate(`/edit/${newPath}`),
      resolveLangHint: (kind) => resolveLangHint(node, kind),
    })
  }

  function requestCreateFile(folderPath: string) {
    files.createFile({
      folderPath,
      onAfterCreate: (newPath) => navigate(`/edit/${newPath}`),
    })
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
    followMoveRename(node.path, to)
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
              onRequestCreateFile={requestCreateFile}
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

      {sortMenu && (
        <SortMenuWrapper
          folderPath={sortMenu.folderPath}
          schema={getSchemaForFolder(sortMenu.folderPath)}
          x={sortMenu.x}
          y={sortMenu.y}
          onClose={() => setSortMenu(null)}
        />
      )}
    </>
  )
}
