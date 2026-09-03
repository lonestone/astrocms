import React, { useState } from 'react'
import Button from '../../common/components/Button.js'
import { Dialog } from '../../common/components/Dialog.js'

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
    <Dialog
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'Working' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-ui leading-relaxed text-text-secondary">{message}</p>
      {error && <p className="mt-3 text-xs text-danger-text">{error}</p>}
    </Dialog>
  )
}
