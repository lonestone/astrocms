import React, { useMemo } from 'react'
import { diffLines } from 'diff'

interface Props {
  oldStr: string
  newStr: string
}

export function DiffView({ oldStr, newStr }: Props) {
  const changes = useMemo(() => diffLines(oldStr ?? '', newStr ?? ''), [oldStr, newStr])

  return (
    <div className="font-mono text-xs leading-relaxed">
      {changes.map((change, i) => {
        const lines = change.value.replace(/\n$/, '').split('\n')
        return lines.map((line, j) => (
          <div
            key={`${i}-${j}`}
            className={`-mx-3 px-3 ${
              change.added
                ? 'bg-diff-add text-diff-add-text'
                : change.removed
                  ? 'bg-diff-remove text-diff-remove-text'
                  : 'text-text-muted'
            }`}
          >
            <span className="inline-block w-3 select-none text-center opacity-60">
              {change.added ? '+' : change.removed ? '-' : ' '}
            </span>
            {line}
          </div>
        ))
      })}
    </div>
  )
}
