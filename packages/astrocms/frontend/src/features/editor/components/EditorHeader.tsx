import React from 'react'
import { useNavigate } from 'react-router'
import { MdMoreHoriz, MdAdd } from 'react-icons/md'
import Button from '../../common/components/Button.js'
import LangButton from '../../common/components/LangButton.js'
import { useFilePath } from '../contexts/FilePathContext.js'
import { stripExtension } from '../../common/utils/supportedFiles.js'
import { useFiles } from '../../file/contexts/FilesContext.js'
import {
  extOf,
  firstRemainingLocaleSibling,
  isLocaleFilename,
  usedLangsInFolder,
} from '../../file/utils/localeFiles.js'
import type { LangHint } from '../../file/components/PromptDialog.js'
import type { TreeNode } from '../../../api.js'

interface LocaleSibling {
  lang: string
  path: string
}

interface Props {
  isDirty: boolean
  isSaving: boolean
  localeSiblings?: LocaleSibling[] | null
  onSave: () => void
  onSelectFile?: (path: string) => void
}

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

export default function EditorHeader({
  isDirty,
  isSaving,
  localeSiblings,
  onSave,
  onSelectFile,
}: Props) {
  const filePath = useFilePath()!
  const navigate = useNavigate()
  const files = useFiles()

  const fileName = filePath.split('/').pop() ?? ''
  const folderPath = parentOf(filePath)
  const currentLang = stripExtension(fileName)
  const pathToShow = localeSiblings
    ? filePath.split('/').slice(0, -1).join('/')
    : filePath.slice(0, filePath.length - fileName.length) + currentLang
  const missingPart = filePath.slice(pathToShow.length)

  const selfNode = nodeFromPath(filePath)

  function menuOptsFor(node: TreeNode) {
    return {
      onAfterRename: (newPath: string) => {
        if (filePath === node.path) navigate(`/edit/${newPath}`)
      },
      onAfterDuplicate: (newPath: string) => navigate(`/edit/${newPath}`),
      onAfterMove: (newPath: string) => {
        if (filePath === node.path) navigate(`/edit/${newPath}`)
      },
      onAfterDelete: (path: string) => {
        if (filePath !== path) return
        const next = firstRemainingLocaleSibling(files.tree, path)
        navigate(next ? `/edit/${next}` : '/')
      },
      resolveLangHint: (kind: 'duplicate' | 'new-file'): LangHint | undefined =>
        kind === 'duplicate' && isLocaleFilename(node.name)
          ? {
              ext: extOf(node.name),
              usedLangs: usedLangsInFolder(files.tree, parentOf(node.path)),
            }
          : undefined,
    }
  }

  function openSelfMenu(x: number, y: number) {
    files.openMenu(selfNode, x, y, menuOptsFor(selfNode))
  }

  function openSiblingMenu(siblingPath: string, x: number, y: number) {
    const node = nodeFromPath(siblingPath)
    files.openMenu(node, x, y, menuOptsFor(node))
  }

  function openCreateInCurrentFolder() {
    const langHint: LangHint | undefined =
      localeSiblings && localeSiblings.length > 0
        ? {
            ext: extOf(localeSiblings[0].path.split('/').pop() ?? ''),
            usedLangs: localeSiblings.map((s) => s.lang),
          }
        : undefined
    files.createFile({
      folderPath,
      langHint,
      onAfterCreate: (newPath) => navigate(`/edit/${newPath}`),
    })
  }

  return (
    <div className="flex items-stretch">
      <div
        className="group relative flex items-center gap-1 text-xl font-bold py-2 pl-3 shrink-0 whitespace-nowrap"
        onContextMenu={(e) => {
          e.preventDefault()
          openSelfMenu(e.clientX, e.clientY)
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
            openSelfMenu(rect.right, rect.bottom)
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
                  openSiblingMenu(s.path, e.clientX, e.clientY)
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
              onClick={openCreateInCurrentFolder}
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
  )
}
