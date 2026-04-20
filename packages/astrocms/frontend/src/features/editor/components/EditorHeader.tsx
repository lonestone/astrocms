import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  MdMoreHoriz,
  MdAdd,
  MdDriveFileRenameOutline,
  MdContentCopy,
  MdDriveFileMoveOutline,
  MdDeleteOutline,
} from 'react-icons/md'
import Button from '../../common/components/Button.js'
import LangButton from '../../common/components/LangButton.js'
import { useFilePath } from '../contexts/FilePathContext.js'
import { stripExtension } from '../../common/utils/supportedFiles.js'
import { useFileOps } from '../../file/hooks/useFileOps.js'
import {
  ActionsMenu,
  type ActionItem,
} from '../../file/components/ActionsMenu.js'
import { PromptDialog, type LangHint } from '../../file/components/PromptDialog.js'
import { MoveDialog } from '../../file/components/MoveDialog.js'
import { ConfirmDialog } from '../../file/components/ConfirmDialog.js'
import {
  extOf,
  isLocaleFilename,
  usedLangsInFolder,
} from '../../file/utils/localeFiles.js'
import type { TreeNode } from '../../../api.js'

interface LocaleSibling {
  lang: string
  path: string
}

interface Props {
  tree: TreeNode[]
  isDirty: boolean
  isSaving: boolean
  localeSiblings?: LocaleSibling[] | null
  onSave: () => void
  onSelectFile?: (path: string) => void
}

type DialogState =
  | { kind: 'rename'; node: TreeNode }
  | { kind: 'duplicate'; node: TreeNode }
  | { kind: 'move'; node: TreeNode }
  | { kind: 'delete'; node: TreeNode }
  | { kind: 'create' }
  | null

function nodeFromPath(path: string): TreeNode {
  return {
    path,
    name: path.split('/').pop() ?? path,
    type: 'file',
  }
}

function parentOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
}

function suggestDuplicateName(name: string): string {
  const ext = name.match(/\.[^.]+$/)?.[0] ?? ''
  const base = name.slice(0, name.length - ext.length)
  return `${base}-copy${ext}`
}

export default function EditorHeader({
  tree,
  isDirty,
  isSaving,
  localeSiblings,
  onSave,
  onSelectFile,
}: Props) {
  const filePath = useFilePath()!
  const navigate = useNavigate()
  const fileOps = useFileOps()

  const fileName = filePath.split('/').pop() ?? ''
  const folderPath = parentOf(filePath)
  const currentLang = stripExtension(fileName)
  const pathToShow = localeSiblings
    ? filePath.split('/').slice(0, -1).join('/')
    : filePath.slice(0, filePath.length - fileName.length) + currentLang
  const missingPart = filePath.slice(pathToShow.length)

  const [menu, setMenu] = useState<{
    node: TreeNode
    x: number
    y: number
  } | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  const selfNode = nodeFromPath(filePath)

  function openMenuFor(node: TreeNode, x: number, y: number) {
    setMenu({ node, x, y })
  }

  function buildItems(node: TreeNode): ActionItem[] {
    return [
      {
        label: 'Rename',
        icon: <MdDriveFileRenameOutline className="w-3.5 h-3.5" />,
        onClick: () => setDialog({ kind: 'rename', node }),
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
      },
    ]
  }

  async function handleRename(node: TreeNode, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === node.name) {
      setDialog(null)
      return
    }
    const parent = parentOf(node.path)
    const to = parent ? `${parent}/${trimmed}` : trimmed
    await fileOps.rename.mutateAsync({ from: node.path, to })
    setDialog(null)
    if (filePath === node.path) navigate(`/edit/${to}`)
  }

  async function handleDuplicate(node: TreeNode, newName: string) {
    const parent = parentOf(node.path)
    const to = parent ? `${parent}/${newName}` : newName
    await fileOps.duplicate.mutateAsync({ from: node.path, to })
    setDialog(null)
    navigate(`/edit/${to}`)
  }

  async function handleMove(node: TreeNode, destFolder: string) {
    const to = destFolder ? `${destFolder}/${node.name}` : node.name
    if (to === node.path) {
      setDialog(null)
      return
    }
    await fileOps.rename.mutateAsync({ from: node.path, to })
    setDialog(null)
    if (filePath === node.path) navigate(`/edit/${to}`)
  }

  async function handleDelete(node: TreeNode) {
    await fileOps.remove.mutateAsync({ path: node.path })
    setDialog(null)
    if (filePath === node.path) navigate('/')
  }

  async function handleCreate(name: string) {
    const finalName = name.includes('.') ? name : `${name}.mdx`
    const path = folderPath ? `${folderPath}/${finalName}` : finalName
    await fileOps.create.mutateAsync({ path })
    setDialog(null)
    navigate(`/edit/${path}`)
  }

  return (
    <>
      <div className="flex items-stretch">
        <div
          className="group relative flex items-center gap-1 text-xl font-bold py-2 pl-3 shrink-0 whitespace-nowrap"
          onContextMenu={(e) => {
            e.preventDefault()
            openMenuFor(selfNode, e.clientX, e.clientY)
          }}
        >
          <span>
            {pathToShow.split('/').map((part, i) => (
              <span key={i}>
                {i > 0 && (
                  <span className="text-text-muted/40 font-normal mx-2">/</span>
                )}
                {part}
              </span>
            ))}
            {missingPart &&
              (missingPart.startsWith('/') ? (
                missingPart
                  .slice(1)
                  .split('/')
                  .map((part, i) => (
                    <span
                      key={`m${i}`}
                      className="text-text-muted/40 font-normal"
                    >
                      <span className="mx-2">/</span>
                      {part}
                    </span>
                  ))
              ) : (
                <span className="text-text-muted/40 font-normal">
                  {missingPart}
                </span>
              ))}
          </span>
          <button
            type="button"
            aria-label="Actions"
            title="Actions"
            onClick={(e) => {
              e.stopPropagation()
              const rect = (
                e.currentTarget as HTMLElement
              ).getBoundingClientRect()
              openMenuFor(selfNode, rect.right, rect.bottom)
            }}
            className="ml-1 w-6 h-6 rounded text-text-muted hover:bg-border opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center cursor-pointer"
          >
            <MdMoreHoriz className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-w-0 overflow-x-auto pb-px">
        {localeSiblings && localeSiblings.length > 1 && (
          <div className="ml-1 flex h-full items-stretch gap-1">
            {localeSiblings.map((s) => (
              <span
                key={s.lang}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openMenuFor(nodeFromPath(s.path), e.clientX, e.clientY)
                }}
                className="contents"
              >
                <LangButton
                  lang={s.lang}
                  active={s.lang === currentLang}
                  onClick={() => onSelectFile?.(s.path)}
                />
              </span>
            ))}
            <button
              type="button"
              aria-label="New file in this folder"
              title="New file in this folder"
              onClick={() => setDialog({ kind: 'create' })}
              className="self-center ml-1 w-6 h-6 rounded text-text-muted hover:bg-border flex items-center justify-center cursor-pointer"
            >
              <MdAdd className="w-5 h-5" />
            </button>
          </div>
        )}
        </div>
        <div className="shrink-0 pl-2 flex items-center">
          <Button
            variant="primary"
            onClick={onSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {menu && (
        <ActionsMenu
          items={buildItems(menu.node)}
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
          onConfirm={(name) => handleRename(dialog.node, name)}
        />
      )}
      {dialog?.kind === 'duplicate' && (
        <PromptDialog
          title={`Duplicate ${dialog.node.name}`}
          label="New name"
          initialValue={suggestDuplicateName(dialog.node.name)}
          confirmLabel="Duplicate"
          onCancel={() => setDialog(null)}
          onConfirm={(name) => handleDuplicate(dialog.node, name)}
          langHint={
            isLocaleFilename(dialog.node.name)
              ? {
                  ext: extOf(dialog.node.name),
                  usedLangs: usedLangsInFolder(tree, parentOf(dialog.node.path)),
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
          message={`This will permanently delete "${dialog.node.path}".`}
          confirmLabel="Delete"
          confirmVariant="danger"
          onCancel={() => setDialog(null)}
          onConfirm={() => handleDelete(dialog.node)}
        />
      )}
      {dialog?.kind === 'create' && (
        <PromptDialog
          title={folderPath ? `New file in ${folderPath}` : 'New file'}
          label="Filename"
          initialValue="new-file.mdx"
          confirmLabel="Create"
          onCancel={() => setDialog(null)}
          onConfirm={handleCreate}
          langHint={
            localeSiblings && localeSiblings.length > 0
              ? {
                  ext: extOf(localeSiblings[0].path.split('/').pop() ?? ''),
                  usedLangs: localeSiblings.map((s) => s.lang),
                }
              : undefined
          }
        />
      )}
    </>
  )
}
