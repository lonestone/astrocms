import React from 'react'
import { useNavigate } from 'react-router'
import { TbCheck, TbDots, TbLoader2, TbPlus } from 'react-icons/tb'
import LangButton from '../../common/components/LangButton.js'
import { IconButton } from '../../common/components/IconButton.js'
import { useFilePath } from '../contexts/FilePathContext.js'
import { stripExtension } from '../../common/utils/supportedFiles.js'
import { parentOf } from '../../common/utils/paths.js'
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
  onSelectFile?: (path: string) => void
}

function nodeFromPath(path: string): TreeNode {
  return {
    path,
    name: path.split('/').pop() ?? path,
    type: 'file',
  }
}

export default function EditorHeader({
  isDirty,
  isSaving,
  localeSiblings,
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

  const segments = pathToShow.split('/')
  const lastIndex = segments.length - 1
  const missingSegments = missingPart
    ? missingPart.startsWith('/')
      ? missingPart.slice(1).split('/')
      : [missingPart]
    : []

  return (
    <div className="mb-3 flex min-h-9 items-center gap-3">
      <div
        className="group flex min-w-0 flex-1 items-center gap-1"
        onContextMenu={(e) => {
          e.preventDefault()
          openSelfMenu(e.clientX, e.clientY)
        }}
      >
        <h1 className="flex min-w-0 items-baseline truncate text-lg font-semibold tracking-tight">
          {segments.map((part, i) => (
            <span key={i} className="flex min-w-0 items-baseline">
              {i > 0 && (
                <span className="mx-1.5 font-normal text-text-faint">/</span>
              )}
              <span
                className={
                  i === lastIndex
                    ? 'truncate text-text'
                    : 'truncate font-normal text-text-muted'
                }
              >
                {part}
              </span>
            </span>
          ))}
          {missingSegments.map((part, i) => (
            <span key={`m${i}`} className="flex items-baseline">
              {(missingPart.startsWith('/') || i > 0) && (
                <span className="mx-1.5 font-normal text-text-faint">/</span>
              )}
              <span className="font-normal text-text-faint">{part}</span>
            </span>
          ))}
        </h1>
        <IconButton
          label="File actions"
          onClick={(e) => {
            e.stopPropagation()
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
            openSelfMenu(rect.right, rect.bottom)
          }}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <TbDots size={18} />
        </IconButton>
      </div>

      {localeSiblings && localeSiblings.length > 1 && (
        <div className="flex shrink-0 items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-md bg-surface-active/70 p-0.5">
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
          </div>
          <IconButton
            label="Add a translation"
            onClick={openCreateInCurrentFolder}
          >
            <TbPlus size={16} />
          </IconButton>
        </div>
      )}

      <SaveStatus isDirty={isDirty} isSaving={isSaving} />
    </div>
  )
}

function SaveStatus({
  isDirty,
  isSaving,
}: {
  isDirty: boolean
  isSaving: boolean
}) {
  if (isSaving) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 text-xs text-text-muted"
        aria-live="polite"
      >
        <TbLoader2 size={14} className="animate-spin" />
        Saving
      </span>
    )
  }
  if (isDirty) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 text-xs text-warning-text"
        aria-live="polite"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
        Unsaved
      </span>
    )
  }
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-xs text-text-faint"
      aria-live="polite"
    >
      <TbCheck size={14} />
      Saved
    </span>
  )
}
