import React, { useState } from 'react'
import { TbTrash } from 'react-icons/tb'
import { GitFileDiff } from './GitFileDiff.js'
import {
  useGitDiscard,
  useGitStage,
  useGitUnstage,
} from '../hooks/useGit.js'
import Button from '../../common/components/Button.js'
import type { GitFile } from '../../../api.js'

interface Props {
  file: GitFile
  diff: string
}

const STATUS_LABEL: Record<string, string> = {
  M: 'Modified',
  A: 'Added',
  D: 'Deleted',
  R: 'Renamed',
  '?': 'New',
  U: 'Conflict',
}

function statusStyle(status: string) {
  if (status === 'D') return 'bg-danger-soft text-danger-text'
  if (status === 'A' || status === '?') return 'bg-success-soft text-success-text'
  if (status === 'U') return 'bg-warning-soft text-warning-text'
  return 'bg-accent-soft text-accent-text'
}

export function GitReviewFile({ file, diff }: Props) {
  const stage = useGitStage()
  const unstage = useGitUnstage()
  const discard = useGitDiscard()
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  function setStaged(next: boolean) {
    if (next) stage.mutate([file.path])
    else unstage.mutate([file.path])
  }

  function handleHeaderClick(e: React.MouseEvent) {
    // Ignore clicks coming from interactive children (checkbox, discard button)
    // so they don't double-toggle.
    if ((e.target as HTMLElement).closest('button, input')) return
    setStaged(!file.staged)
  }

  function handleDiscard(e: React.MouseEvent) {
    e.stopPropagation()
    if (confirmDiscard) {
      discard.mutate(file.path)
      setConfirmDiscard(false)
    } else {
      setConfirmDiscard(true)
    }
  }

  const dir = file.path.includes('/')
    ? file.path.slice(0, file.path.lastIndexOf('/') + 1)
    : ''
  const base = file.path.slice(dir.length)

  return (
    <section
      id={`file-${file.path}`}
      className={`overflow-hidden rounded-panel border bg-surface-raised transition-colors ${
        file.staged ? 'border-border' : 'border-border opacity-80'
      }`}
    >
      <header
        onClick={handleHeaderClick}
        className="sticky top-0 z-10 flex cursor-pointer select-none items-center gap-3 border-b border-border bg-surface px-4 py-2.5 transition-colors hover:bg-surface-hover"
      >
        <input
          type="checkbox"
          checked={file.staged}
          onChange={(e) => setStaged(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="h-3.5 w-3.5 cursor-pointer accent-accent"
          aria-label={`Include ${file.path}`}
        />
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle(
            file.status
          )}`}
        >
          {STATUS_LABEL[file.status] || file.status}
        </span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-ui"
          title={file.path}
        >
          <span className="text-text-muted">{dir}</span>
          <span className="text-text">{base}</span>
        </span>
        {confirmDiscard ? (
          <div className="flex gap-1">
            <Button size="sm" variant="danger" onClick={handleDiscard}>
              Discard changes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                setConfirmDiscard(false)
              }}
            >
              Keep
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDiscard}
            icon={<TbTrash size={14} />}
            aria-label={`Discard all changes for ${file.path}`}
            className="hover:text-danger-text!"
          >
            Discard
          </Button>
        )}
      </header>
      <GitFileDiff path={file.path} diff={diff} />
    </section>
  )
}
