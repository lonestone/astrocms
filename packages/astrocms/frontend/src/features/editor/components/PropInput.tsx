import React, { useMemo, useCallback, useState, useEffect } from 'react'
import { TbPlus, TbX } from 'react-icons/tb'
import type { PropSchema } from '../../../api.js'
import { useMediaModal } from '../../file/components/MediaModal.js'
import { resolvePreviewSrc } from '../utils/resolvePreviewSrc.js'
import { usePublicConfig } from '../../common/hooks/usePublicConfig.js'
import { useFilePath } from '../contexts/FilePathContext.js'
import Button from '../../common/components/Button.js'
import { IconButton } from '../../common/components/IconButton.js'
import { inputClass } from '../../common/components/Input.js'

export const inputClassName = inputClass

export const labelClassName =
  'flex items-start gap-3 text-ui text-text-secondary select-none'

const labelTextClassName =
  'w-36 shrink-0 truncate pt-2 text-ui font-medium leading-5 text-text-muted'

/**
 * Input that keeps local state and only calls onChange on blur or Enter.
 * Prevents every keystroke from triggering a parent state change.
 */
function DeferredInput({
  value,
  onChange,
  className,
  ...rest
}: {
  value: string
  onChange: (value: string) => void
  className?: string
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'className'
>) {
  const [local, setLocal] = useState(value)
  useEffect(() => {
    setLocal(value)
  }, [value])

  const commit = useCallback(() => {
    if (local !== value) onChange(local)
  }, [local, value, onChange])

  return (
    <input
      {...rest}
      className={className}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        // Stop propagation so Lexical doesn't intercept undo/redo etc.
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
    />
  )
}

/** Convert camelCase to "Title Case" label */
export function formatLabel(name: string): string {
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Normalize a date-ish string to YYYY-MM-DD for `<input type="date">` */
function toDateInputValue(value: string): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ---------------------------------------------------------------------------
// Image prop input with preview and media picker
// ---------------------------------------------------------------------------

export function ImagePropInput({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (value: string) => void
}) {
  const filePath = useFilePath()!
  const { openMediaModal } = useMediaModal()

  const config = usePublicConfig()

  const previewSrc = useMemo(
    () => resolvePreviewSrc(value, filePath, config),
    [value, filePath, config]
  )

  const handleSelect = useCallback(() => {
    openMediaModal({ filePath, onSelect: onChange })
  }, [filePath, onChange, openMediaModal])

  return (
    <label className={labelClassName}>
      <span className={labelTextClassName}>{formatLabel(name)}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {previewSrc && (
          <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-inset">
            <img
              src={previewSrc}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </span>
        )}
        <DeferredInput
          type="text"
          value={value}
          onChange={onChange}
          className={inputClassName}
          placeholder="./image.png"
        />
        <Button size="md" onClick={handleSelect}>
          Browse
        </Button>
      </span>
    </label>
  )
}

// ---------------------------------------------------------------------------
// String array editor (variable-length list)
// ---------------------------------------------------------------------------

function StringArrayInput({
  name,
  items,
  onChangeItems,
}: {
  name: string
  items: string[]
  onChangeItems: (items: string[]) => void
}) {
  return (
    <div className={labelClassName}>
      <span className={labelTextClassName}>{formatLabel(name)}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <DeferredInput
              type="text"
              value={item}
              onChange={(v) => {
                const next = [...items]
                next[i] = v
                onChangeItems(next)
              }}
              className={inputClassName}
            />
            <IconButton
              label="Remove"
              size="sm"
              tone="danger"
              onClick={() => onChangeItems(items.filter((_, j) => j !== i))}
            >
              <TbX size={14} />
            </IconButton>
          </div>
        ))}
        <Button
          variant="dashed"
          size="sm"
          icon={<TbPlus size={14} />}
          onClick={() => onChangeItems([...items, ''])}
          className="self-start"
        >
          Add
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generic PropInput that renders the right input based on schema type
// ---------------------------------------------------------------------------

interface PropInputProps {
  schema: PropSchema
  value: string
  onChange: (value: string) => void
  /** For string-array type: the raw array value */
  arrayValue?: string[]
  /** For string-array type: callback with the updated array */
  onChangeArray?: (items: string[]) => void
}

export function PropInput({
  schema,
  value,
  onChange,
  arrayValue,
  onChangeArray,
}: PropInputProps) {
  const { name, type } = schema

  // Select
  if (type === 'select' && schema.options) {
    return (
      <label className={labelClassName}>
        <span className={labelTextClassName}>{formatLabel(name)}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClassName} max-w-xs`}
        >
          <option value=""></option>
          {schema.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    )
  }

  // Image picker
  if (type === 'image') {
    return <ImagePropInput name={name} value={value} onChange={onChange} />
  }

  // Boolean checkbox
  if (type === 'boolean') {
    return (
      <label className={`${labelClassName} cursor-pointer`}>
        <span className={labelTextClassName}>{formatLabel(name)}</span>
        <span className="flex h-9 items-center">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(e) => onChange(e.target.checked ? 'true' : '')}
            className="h-4 w-4 cursor-pointer rounded accent-accent"
          />
        </span>
      </label>
    )
  }

  // Number
  if (type === 'number') {
    return (
      <label className={labelClassName}>
        <span className={labelTextClassName}>{formatLabel(name)}</span>
        <DeferredInput
          type="number"
          value={value}
          onChange={onChange}
          className={`${inputClassName} max-w-28`}
        />
      </label>
    )
  }

  // Date
  if (type === 'date') {
    return (
      <label className={labelClassName}>
        <span className={labelTextClassName}>{formatLabel(name)}</span>
        <input
          type="date"
          value={toDateInputValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClassName} max-w-44`}
        />
      </label>
    )
  }

  // String array (variable-length list)
  if (type === 'string-array' && onChangeArray) {
    return (
      <StringArrayInput
        name={name}
        items={arrayValue ?? []}
        onChangeItems={onChangeArray}
      />
    )
  }

  // Default: text input (string, json without schema)
  return (
    <label className={labelClassName}>
      <span className={labelTextClassName}>{formatLabel(name)}</span>
      <DeferredInput
        type="text"
        value={value}
        onChange={onChange}
        className={inputClassName}
      />
    </label>
  )
}
