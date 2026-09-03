import React, { useState } from 'react'
import { TbBrain } from 'react-icons/tb'
import { Arrow } from './Arrow.js'

interface Props {
  text: string
}

export function ThinkingBlock({ text }: Props) {
  const [open, setOpen] = useState(false)
  if (!text) return null

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-text-muted cursor-pointer transition-colors hover:text-text"
        aria-expanded={open}
      >
        <Arrow open={open} />
        <TbBrain size={14} />
        Thinking
      </button>
      {open && (
        <div className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-surface-inset px-3 py-2 text-xs italic leading-relaxed text-text-secondary">
          {text}
        </div>
      )}
    </div>
  )
}
