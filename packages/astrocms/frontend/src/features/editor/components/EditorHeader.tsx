import React from 'react'
import Button from '../../common/components/Button.js'
import LangButton from '../../common/components/LangButton.js'
import { useFilePath } from '../contexts/FilePathContext.js'
import { stripExtension } from '../../common/utils/supportedFiles.js'

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

export default function EditorHeader({
  isDirty,
  isSaving,
  localeSiblings,
  onSave,
  onSelectFile,
}: Props) {
  const filePath = useFilePath()!
  const fileName = filePath.split('/').pop() ?? ''
  const currentLang = stripExtension(fileName)
  const pathToShow = localeSiblings
    ? filePath.split('/').slice(0, -1).join('/')
    : filePath.slice(0, filePath.length - fileName.length) + currentLang
  const missingPart = filePath.slice(pathToShow.length)

  return (
    <div className="flex items-center justify-between">
      <div className="text-xl font-bold py-2 pl-3">
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
                <span key={`m${i}`} className="text-text-muted/40 font-normal">
                  <span className="mx-2">/</span>
                  {part}
                </span>
              ))
          ) : (
            <span className="text-text-muted/40 font-normal">
              {missingPart}
            </span>
          ))}
      </div>
      {localeSiblings && localeSiblings.length > 1 && (
        <div className="ml-4 flex h-full items-stretch gap-1">
          {localeSiblings.map((s) => (
            <LangButton
              key={s.lang}
              lang={s.lang}
              active={s.lang === currentLang}
              onClick={() => onSelectFile?.(s.path)}
            />
          ))}
        </div>
      )}
      <div className="flex-1 text-right">
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
