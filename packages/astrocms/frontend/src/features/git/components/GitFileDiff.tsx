import React, { useMemo, useState } from 'react'
import { TbTrash } from 'react-icons/tb'
import Button from '../../common/components/Button.js'
import { useGitDiscardHunk } from '../hooks/useGit.js'

interface Props {
  path: string
  diff: string
}

type LineKind = 'add' | 'remove' | 'context' | 'nonewline'

interface ParsedHunk {
  header: string
  lines: { kind: LineKind; text: string }[]
  /** Full hunk text (header + body) suitable for piping to `git apply`. */
  raw: string
}

function parseHunks(raw: string): ParsedHunk[] {
  const hunks: ParsedHunk[] = []
  let current: ParsedHunk | null = null

  for (const line of raw.split('\n')) {
    if (
      line.startsWith('diff --git') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('new file mode') ||
      line.startsWith('deleted file mode') ||
      line.startsWith('old mode') ||
      line.startsWith('new mode') ||
      line.startsWith('similarity index') ||
      line.startsWith('rename from') ||
      line.startsWith('rename to') ||
      line.startsWith('copy from') ||
      line.startsWith('copy to')
    ) {
      continue
    }

    if (line.startsWith('@@')) {
      if (current) hunks.push(current)
      current = { header: line, lines: [], raw: line + '\n' }
      continue
    }

    if (!current) continue
    current.raw += line + '\n'

    if (line.startsWith('+')) {
      current.lines.push({ kind: 'add', text: line.slice(1) })
    } else if (line.startsWith('-')) {
      current.lines.push({ kind: 'remove', text: line.slice(1) })
    } else if (line.startsWith(' ')) {
      current.lines.push({ kind: 'context', text: line.slice(1) })
    } else if (line.startsWith('\\')) {
      current.lines.push({ kind: 'nonewline', text: line })
    }
  }

  if (current) hunks.push(current)
  return hunks
}

export function GitFileDiff({ path, diff }: Props) {
  const hunks = useMemo(() => parseHunks(diff), [diff])
  const discardHunk = useGitDiscardHunk()
  const [pending, setPending] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<number | null>(null)

  if (hunks.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-xs text-text-muted">
        No line changes to show.
      </div>
    )
  }

  function handleDiscard(index: number, hunk: ParsedHunk) {
    if (confirm !== index) {
      setConfirm(index)
      return
    }
    setPending(index)
    discardHunk.mutate(
      { path, hunk: hunk.raw },
      {
        onSettled: () => {
          setPending(null)
          setConfirm(null)
        },
      }
    )
  }

  return (
    <div className="divide-y divide-border">
      {hunks.map((hunk, i) => {
        const isPending = pending === i
        const isConfirm = confirm === i
        return (
          <div key={i}>
            <div className="flex items-center gap-3 bg-surface-inset px-4 py-1">
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">
                {hunk.header}
              </code>
              {isConfirm ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDiscard(i, hunk)}
                    disabled={isPending}
                    aria-label="Confirm discard hunk"
                  >
                    {isPending ? 'Discarding' : 'Discard hunk'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirm(null)}
                    aria-label="Cancel"
                  >
                    Keep
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDiscard(i, hunk)}
                  aria-label="Discard this hunk"
                  className="inline-flex h-5 items-center gap-1 rounded px-1.5 text-xs text-text-muted cursor-pointer transition-colors hover:bg-danger-soft hover:text-danger-text"
                >
                  <TbTrash size={13} />
                  Discard
                </button>
              )}
            </div>
            <pre className="font-mono text-xs leading-6">
              {hunk.lines.map((line, j) => {
                if (line.kind === 'nonewline') {
                  return (
                    <div key={j} className="px-4 py-0.5 text-text-muted">
                      {line.text}
                    </div>
                  )
                }
                const bg =
                  line.kind === 'add'
                    ? 'bg-diff-add text-diff-add-text'
                    : line.kind === 'remove'
                    ? 'bg-diff-remove text-diff-remove-text'
                    : 'text-text-secondary'
                const marker =
                  line.kind === 'add'
                    ? '+'
                    : line.kind === 'remove'
                    ? '-'
                    : ' '
                const markerColor =
                  line.kind === 'context' ? 'text-text-faint' : 'opacity-70'
                return (
                  <div key={j} className={`flex px-4 ${bg}`}>
                    <span
                      className={`inline-block w-4 shrink-0 select-none ${markerColor}`}
                    >
                      {marker}
                    </span>
                    <span className="whitespace-pre-wrap break-all min-w-0 flex-1">
                      {line.text || ' '}
                    </span>
                  </div>
                )
              })}
            </pre>
          </div>
        )
      })}
      {discardHunk.error && (
        <div className="px-4 py-2 text-xs text-danger-text">
          {discardHunk.error.message}
        </div>
      )}
    </div>
  )
}
