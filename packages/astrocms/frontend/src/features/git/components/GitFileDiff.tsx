import React, { useMemo, useState } from 'react'
import { FiTrash2 } from 'react-icons/fi'
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
      <div className="px-4 py-6 text-xs text-text-muted text-center">
        No changes to display.
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
            <div className="flex items-center gap-3 px-4 py-1 bg-blue-50 border-y border-blue-100">
              <code className="text-[11px] text-blue-700 flex-1 font-mono truncate">
                {hunk.header}
              </code>
              {isConfirm ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDiscard(i, hunk)}
                    disabled={isPending}
                    aria-label="Confirm discard hunk"
                    tabIndex={0}
                    className="text-[11px] font-semibold text-danger border border-danger rounded px-2 py-0.5 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                  >
                    {isPending ? '...' : 'Confirm discard'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm(null)}
                    aria-label="Cancel"
                    tabIndex={0}
                    className="text-[11px] text-text-muted border border-border rounded px-2 py-0.5 hover:bg-gray-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDiscard(i, hunk)}
                  aria-label="Discard this hunk"
                  tabIndex={0}
                  className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-danger rounded px-1.5 py-0.5 cursor-pointer"
                >
                  <FiTrash2 size={11} />
                  Discard
                </button>
              )}
            </div>
            <pre className="font-mono text-xs leading-5">
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
                    ? 'bg-green-50'
                    : line.kind === 'remove'
                    ? 'bg-red-50'
                    : ''
                const marker =
                  line.kind === 'add'
                    ? '+'
                    : line.kind === 'remove'
                    ? '-'
                    : ' '
                const markerColor =
                  line.kind === 'add'
                    ? 'text-green-700'
                    : line.kind === 'remove'
                    ? 'text-red-700'
                    : 'text-text-muted'
                return (
                  <div key={j} className={`flex px-4 ${bg}`}>
                    <span
                      className={`inline-block w-4 shrink-0 select-none ${markerColor}`}
                    >
                      {marker}
                    </span>
                    <span className="whitespace-pre">{line.text || ' '}</span>
                  </div>
                )
              })}
            </pre>
          </div>
        )
      })}
      {discardHunk.error && (
        <div className="px-4 py-2 text-xs text-danger">
          {discardHunk.error.message}
        </div>
      )}
    </div>
  )
}
