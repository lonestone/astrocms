import React, { useEffect, useRef, useState } from 'react'

interface Props {
  initialValue: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function InlineRenameInput({ initialValue, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    const dot = initialValue.lastIndexOf('.')
    if (dot > 0) el.setSelectionRange(0, dot)
    else el.select()
  }, [initialValue])

  function commit() {
    if (submittedRef.current) return
    submittedRef.current = true
    onSubmit(value)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          submittedRef.current = true
          onCancel()
        }
      }}
      onBlur={commit}
      style={{ font: 'inherit', lineHeight: 'inherit' }}
      className="m-0 min-w-0 flex-1 rounded-sm border-0 bg-surface-raised px-1 -mx-1 text-xs text-text outline-none ring-2 ring-accent"
    />
  )
}
