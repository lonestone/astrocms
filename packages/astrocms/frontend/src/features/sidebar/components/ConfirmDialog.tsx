import React, { useState } from 'react'
import Button from '../../common/components/Button.js'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'primary' | 'danger' | 'success'
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'OK',
  confirmVariant = 'danger',
  onCancel,
  onConfirm,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
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
        <p className="mb-4 text-xs text-text">{message}</p>
        {error && <div className="mb-3 text-xs text-danger">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? '...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
