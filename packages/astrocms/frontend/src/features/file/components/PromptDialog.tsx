import React, { useEffect, useRef, useState } from 'react'
import Button from '../../common/components/Button.js'
import { LangPicker } from './LangPicker.js'

export interface LangHint {
  /** Extension to append to the picked lang, e.g. ".mdx" */
  ext: string
  /** Langs already present in the target folder (grayed out in the picker). */
  usedLangs: string[]
}

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
  langHint?: LangHint
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
  langHint,
}: Props) {
  const [value, setValue] = useState(initialValue)
  const [mode, setMode] = useState<'lang' | 'name'>(
    langHint ? 'lang' : 'name'
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mode !== 'name') return
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
  }, [mode, initialValue, selectExtension])

  async function handleSubmit(override?: string) {
    const v = (override ?? value).trim()
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

  function handlePickLang(lang: string) {
    handleSubmit(`${lang}${langHint!.ext}`)
  }

  return (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onCancel()
        }
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-sm p-5 shadow-2xl">
        <h3 className="mb-3 text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mb-3 text-xs text-text-muted">{description}</p>
        )}

        {mode === 'lang' && langHint ? (
          <>
            <LangPicker
              usedLangs={langHint.usedLangs}
              onSelect={handlePickLang}
            />
            <button
              type="button"
              onClick={() => setMode('name')}
              className="mt-3 mb-1 text-xs text-primary hover:underline cursor-pointer"
            >
              Use a custom name instead
            </button>
          </>
        ) : (
          <>
            <label className="block mb-2 text-xs text-gray-500">
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
            {langHint && (
              <button
                type="button"
                onClick={() => setMode('lang')}
                className="mb-4 text-xs text-primary hover:underline cursor-pointer"
              >
                &larr; Pick a language instead
              </button>
            )}
          </>
        )}

        {error && <div className="mb-3 text-xs text-danger">{error}</div>}
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          {mode === 'name' && (
            <Button
              variant={confirmVariant}
              onClick={() => handleSubmit()}
              disabled={busy || !value.trim()}
            >
              {busy ? '...' : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
