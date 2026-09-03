import React, { useMemo } from 'react'
import {
  TbChevronRight,
  TbDatabase,
  TbFileText,
  TbFolder,
  TbFolderOpen,
} from 'react-icons/tb'
import type { TreeNode, FrontmatterFieldSchema } from '../../../api.js'
import { useCurrentLang } from '../../common/contexts/CurrentLangContext.js'
import { getFolderTarget } from '../../common/utils/folderTarget.js'
import {
  isSupportedFile,
  stripExtension,
} from '../../common/utils/supportedFiles.js'
import { useFolderName } from '../hooks/useFolderName.js'
import {
  useFolderSort,
  DEFAULT_SORT,
  type FolderSort,
} from '../hooks/useFolderSort.js'
import {
  FILENAME_FIELD,
  getDefaultNameField,
  getDefaultSort,
} from '../utils/collectionDefaults.js'
import { hasSupportedFiles } from '../utils/treeHelpers.js'
import {
  formatSortValue,
  getNodeFieldValue,
  sortTreeChildren,
} from '../utils/treeSort.js'
import { InlineRenameInput } from '../../file/components/InlineRenameInput.js'
import { RowActions } from './RowActions.js'

export interface TreeItemProps {
  node: TreeNode
  depth: number
  selectedFile: string | null
  openFolders: Set<string>
  onToggleFolder: (path: string) => void
  onSelectFile: (path: string) => void
  getSchemaForFolder: (path: string) => FrontmatterFieldSchema[] | undefined
  onOpenActionsMenu: (node: TreeNode, x: number, y: number) => void
  onOpenSortMenu: (folderPath: string, x: number, y: number) => void
  onRequestCreateFile: (folderPath: string) => void
  renamingPath: string | null
  onStartRename: (path: string) => void
  onSubmitRename: (node: TreeNode, newName: string) => void | Promise<void>
  onCancelRename: () => void
  inheritedSort?: FolderSort
  inheritedNameField?: string
  isCollectionFolder: (path: string) => boolean
  searching?: boolean
}

const INDENT = 16
const BASE_PAD = 8

export function TreeItem(props: TreeItemProps) {
  const {
    node,
    depth,
    selectedFile,
    openFolders,
    onToggleFolder,
    onSelectFile,
    getSchemaForFolder,
    onOpenActionsMenu,
    onOpenSortMenu,
    onRequestCreateFile,
    renamingPath,
    onStartRename,
    onSubmitRename,
    onCancelRename,
    inheritedSort,
    inheritedNameField,
    isCollectionFolder,
    searching,
  } = props

  const { effectiveLang } = useCurrentLang()

  const isCollection = isCollectionFolder(node.path)
  const isRenaming = renamingPath === node.path && !isCollection

  const expanded = openFolders.has(node.path)
  const isFile = node.type === 'file'
  const isSupported = isSupportedFile(node.name)

  const folderTarget = !isFile ? getFolderTarget(node, effectiveLang) : null
  const isCollapsedFolder = folderTarget !== null

  const isSelected = isFile
    ? selectedFile === node.path
    : isCollapsedFolder &&
      node.children?.some((c) => c.path === selectedFile) === true

  const isRealFolder = !isFile && !isCollapsedFolder

  // Schema-derived defaults apply on collection roots only.
  const schema = useMemo(
    () => (isCollection ? getSchemaForFolder(node.path) : undefined),
    [isCollection, getSchemaForFolder, node.path]
  )
  const smartSort = useMemo(() => getDefaultSort(schema), [schema])
  const smartName = useMemo(() => getDefaultNameField(schema), [schema])

  const { sort: ownSort, isDefault: ownSortIsDefault } = useFolderSort(
    node.path,
    smartSort
  )
  const { name: ownNameField } = useFolderName(node.path, smartName)

  // Only collection folders own a sort/name config; everyone else inherits
  // from the nearest ancestor collection.
  const effectiveSort: FolderSort = isCollection
    ? ownSort
    : inheritedSort ?? DEFAULT_SORT
  const effectiveNameField = isCollection
    ? ownNameField
    : inheritedNameField ?? FILENAME_FIELD

  const sortedChildren = useMemo(() => {
    if (!isRealFolder || !node.children) return node.children
    return sortTreeChildren(node.children, effectiveSort, effectiveLang)
  }, [isRealFolder, node.children, effectiveSort, effectiveLang])

  if (isFile && !isSupported) return null
  // During search, filterTree has already decided what to include. Otherwise,
  // hide folders that hold no editable content.
  if (!isFile && !searching && !hasSupportedFiles(node)) return null

  const handleClick = () => {
    if (isRenaming) return
    if (isFile && isSupported) {
      onSelectFile(node.path)
    } else if (isCollapsedFolder) {
      onSelectFile(folderTarget!)
    } else {
      onToggleFolder(node.path)
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isRenaming) return
    e.preventDefault()
    onOpenActionsMenu(node, e.clientX, e.clientY)
  }

  // Display label: custom name field's value when the ancestor collection
  // asks for one, falling back to the filename. Only files and collapsed
  // folders (which act as a direct file link) can borrow a content's title;
  // collections always keep their own name, and expanded folders keep theirs
  // to avoid shadowing siblings.
  const canBorrowContentTitle = isFile || (!isCollection && isCollapsedFolder)
  const customName =
    effectiveNameField !== FILENAME_FIELD && canBorrowContentTitle
      ? getNodeFieldValue(node, effectiveNameField, effectiveLang)
      : undefined
  const fallbackLabel = isFile ? stripExtension(node.name) : node.name
  const rowLabel =
    typeof customName === 'string' && customName ? customName : fallbackLabel

  // Right-aligned value: the parent-sort key's value, hidden when it would
  // duplicate the row label. For filename sort we surface the filename only
  // when the display name comes from a frontmatter field.
  const parentSortField = inheritedSort?.field
  let rightLabel = ''
  if (parentSortField && parentSortField !== effectiveNameField) {
    if (parentSortField === FILENAME_FIELD) {
      rightLabel = fallbackLabel
    } else {
      const v = getNodeFieldValue(
        node,
        parentSortField,
        effectiveLang,
        inheritedSort?.order
      )
      if (v !== undefined) rightLabel = formatSortValue(v)
    }
  }

  // Values inherited by descendants.
  const childInheritedSort = effectiveSort
  const childInheritedNameField =
    effectiveNameField !== FILENAME_FIELD ? effectiveNameField : undefined

  const paddingLeft = BASE_PAD + depth * INDENT

  const iconClass = `h-4 w-4 shrink-0 ${
    isSelected ? 'text-accent-text' : ''
  }`

  let icon: React.ReactNode
  if (isFile || isCollapsedFolder) {
    icon = (
      <TbFileText className={`${iconClass} ${isSelected ? '' : 'text-text-muted'}`} />
    )
  } else if (isCollection) {
    icon = <TbDatabase className={`${iconClass} text-accent-text`} />
  } else if (expanded) {
    icon = <TbFolderOpen className={`${iconClass} text-text-secondary`} />
  } else {
    icon = <TbFolder className={`${iconClass} text-text-secondary`} />
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label={node.name}
        aria-expanded={isRealFolder ? expanded : undefined}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        style={{ paddingLeft }}
        className={`group relative mx-1.5 flex h-8 items-center gap-1.5 rounded-md pr-1 select-none transition-colors duration-100 ${
          isSelected
            ? 'bg-accent-soft text-accent-text'
            : 'text-text hover:bg-surface-hover'
        } ${
          isFile && !isSupported ? 'cursor-default' : 'cursor-pointer'
        } ${isFile || isCollapsedFolder ? 'font-normal' : 'font-medium'}`}
      >
        {isRealFolder ? (
          <TbChevronRight
            size={14}
            className={`-ml-0.5 shrink-0 text-text-faint transition-transform duration-150 ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        ) : (
          <span className="w-[9px] shrink-0" />
        )}
        {icon}

        {isRenaming ? (
          <InlineRenameInput
            initialValue={node.name}
            onSubmit={(name) => onSubmitRename(node, name)}
            onCancel={onCancelRename}
          />
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-ui">{rowLabel}</span>
            {rightLabel && (
              <span
                title={`${parentSortField}: ${rightLabel}`}
                className={`max-w-[40%] shrink-0 truncate text-2xs tabular-nums group-hover:hidden ${
                  isSelected ? 'text-accent-text/70' : 'text-text-faint'
                }`}
              >
                {rightLabel}
              </span>
            )}
            <RowActions
              isRealFolder={isRealFolder}
              showSort={isCollection}
              sortIsDefault={ownSortIsDefault}
              isSelected={!!isSelected}
              onNewFile={() => onRequestCreateFile(node.path)}
              onOpenSortMenu={(e) => {
                e.stopPropagation()
                onOpenSortMenu(node.path, e.clientX, e.clientY)
              }}
              onOpenActionsMenu={(e) => {
                e.stopPropagation()
                const rect = (
                  e.currentTarget as HTMLElement
                ).getBoundingClientRect()
                onOpenActionsMenu(node, rect.right, rect.bottom)
              }}
            />
          </>
        )}
      </div>
      {isRealFolder && expanded && sortedChildren && (
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-border"
            style={{ left: `${paddingLeft + 7 + 6}px` }}
          />
          {sortedChildren.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFile={selectedFile}
              openFolders={openFolders}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
              getSchemaForFolder={getSchemaForFolder}
              onOpenActionsMenu={onOpenActionsMenu}
              onOpenSortMenu={onOpenSortMenu}
              onRequestCreateFile={onRequestCreateFile}
              renamingPath={renamingPath}
              onStartRename={onStartRename}
              onSubmitRename={onSubmitRename}
              onCancelRename={onCancelRename}
              inheritedSort={childInheritedSort}
              inheritedNameField={childInheritedNameField}
              isCollectionFolder={isCollectionFolder}
              searching={searching}
            />
          ))}
        </div>
      )}
    </div>
  )
}
