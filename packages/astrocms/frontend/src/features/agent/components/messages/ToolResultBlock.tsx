import React, { useState } from 'react'
import { Arrow } from './Arrow.js'
import { formatResult } from './utils.js'

interface Props {
  content: any
  isError?: boolean
}

export function ToolResultBlock({ content, isError }: Props) {
  const [open, setOpen] = useState(false)
  const text = formatResult(content)
  if (!text) return null

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-md px-1 py-0.5 text-xs cursor-pointer transition-colors ${
          isError
            ? 'text-danger-text hover:bg-danger-soft'
            : 'text-text-muted hover:text-text'
        }`}
        aria-expanded={open}
      >
        <Arrow open={open} />
        {isError ? 'Error' : 'Result'}
      </button>
      {open && (
        <div
          className={`mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border px-3 py-2 font-mono text-xs ${
            isError
              ? 'border-danger/40 bg-danger-soft text-danger-text'
              : 'border-border bg-surface-inset text-text-secondary'
          }`}
        >
          {text}
        </div>
      )}
    </div>
  )
}
