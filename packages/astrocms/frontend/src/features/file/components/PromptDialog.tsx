import React, { useEffect, useRef, useState } from 'react'
import { TbArrowLeft } from 'react-icons/tb'
import Button from '../../common/components/Button.js'
import { Dialog } from '../../common/components/Dialog.js'
import { Field, Input } from '../../common/components/Input.js'
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

  const pickingLang = mode === 'lang' && !!langHint

  return (
    <Dialog
      title={title}
      description={description}
      onClose={onCancel}
      width={pickingLang ? 'md' : 'sm'}
      footer={
        <>
          {langHint && (
            <Button
              variant="ghost"
              className="mr-auto"
              icon={pickingLang ? undefined : <TbArrowLeft size={16} />}
              onClick={() => setMode(pickingLang ? 'name' : 'lang')}
            >
              {pickingLang ? 'Use a custom name' : 'Pick a language'}
            </Button>
          )}
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          {mode === 'name' && (
            <Button
              variant={confirmVariant}
              onClick={() => handleSubmit()}
              disabled={busy || !value.trim()}
            >
              {busy ? 'Working' : confirmLabel}
            </Button>
          )}
        </>
      }
    >
      {pickingLang ? (
        <LangPicker usedLangs={langHint!.usedLangs} onSelect={handlePickLang} />
      ) : (
        <Field label={label ?? 'Name'} htmlFor="prompt-value" error={error}>
          <Input
            id="prompt-value"
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              }
            }}
            className="font-mono text-xs"
          />
        </Field>
      )}
      {pickingLang && error && (
        <p className="mt-3 text-xs text-danger-text">{error}</p>
      )}
    </Dialog>
  )
}
