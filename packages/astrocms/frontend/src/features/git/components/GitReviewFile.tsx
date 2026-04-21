import React, { useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
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
  '?': 'Untracked',
  U: 'Unmerged',
}

function statusStyle(status: string) {
  if (status === 'D') return 'bg-red-100 text-red-700'
  if (status === 'A' || status === '?') return 'bg-green-100 text-green-700'
  return 'bg-blue-100 text-blue-700'
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

  return (
    <section
      id={`file-${file.path}`}
      className="rounded-lg border border-border bg-white overflow-hidden"
    >
      <header
        onClick={handleHeaderClick}
        className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-gray-50 sticky top-0 z-10 cursor-pointer select-none hover:bg-gray-100"
      >
        <input
          type="checkbox"
          checked={file.staged}
          onChange={(e) => setStaged(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="accent-primary w-4 h-4 cursor-pointer"
          aria-label={`Include ${file.path}`}
        />
        <span
          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle(
            file.status
          )}`}
        >
          {STATUS_LABEL[file.status] || file.status}
        </span>
        <span
          className="font-mono text-xs flex-1 truncate"
          title={file.path}
        >
          {file.path}
        </span>
        {confirmDiscard ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              className="border-danger! text-danger! hover:bg-red-50!"
              onClick={handleDiscard}
            >
              Confirm discard file
            </Button>
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setConfirmDiscard(false)
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleDiscard}
            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-danger px-2 py-1 rounded cursor-pointer"
            aria-label={`Discard all changes for ${file.path}`}
            tabIndex={0}
          >
            <FiTrash2 size={12} />
            Discard file
          </button>
        )}
      </header>
      <GitFileDiff path={file.path} diff={diff} />
    </section>
  )
}
