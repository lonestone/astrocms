import React, { useEffect, useRef, useState } from 'react'
import Button from '../../common/components/Button.js'

interface Props {
  title: string
  label?: string
  initialValue?: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger' | 'success'
  description?: string
  onCancel: () => void
  onConfirm: (value: string) => void | Promise<void>
  selectExtension?: boolean
}

export function PromptDialog({
  title,
  label,
  initialValue = '',
  confirmLabel = 'OK',
  confirmVariant = 'primary',
  description,
  onCancel,
  onConfirm,
  selectExtension = false,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    if (selectExtension) {
      el.select()
    } else {
      const dot = initialValue.lastIndexOf('.')
      if (dot > 0) el.setSelectionRange(0, dot)
      else el.select()
    }
  }, [initialValue, selectExtension])

  async function handleSubmit() {
    const v = value.trim()
    if (!v) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(v)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-sm p-5 shadow-2xl">
        <h3 className="mb-3 text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mb-3 text-xs text-text-muted">{description}</p>
        )}
        <label className="block mb-4 text-xs text-gray-500">
          {label}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
              }
            }}
            className="block w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
          />
        </label>
        {error && <div className="mb-3 text-xs text-danger">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleSubmit}
            disabled={busy || !value.trim()}
          >
            {busy ? '...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
