import React, { useCallback } from 'react'
import type { FrontmatterFieldSchema } from '../../../api.js'
import { TbPlus, TbX } from 'react-icons/tb'
import Button from '../../common/components/Button.js'
import { IconButton } from '../../common/components/IconButton.js'
import { PropInput, formatLabel } from './PropInput.js'
import type { FrontmatterData } from '../../../../../shared/frontmatter.js'

export type { FrontmatterData }

const ESM_LINE_RE = /^(import\s|export\s)/

/**
 * Extract leading import/export lines from the body (MDXEditor does not
 * preserve them). Only the prelude is scanned: we collect ESM lines from the
 * top of the file, tolerating blank lines between them, and stop at the first
 * real content line. ESM appearing later in the document (e.g. inside code
 * blocks) is left untouched.
 */
export function extractEsmLines(body: string): {
  esm: string
  content: string
} {
  const lines = body.split('\n')
  const esmLines: string[] = []
  let splitAt = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (ESM_LINE_RE.test(line)) {
      esmLines.push(line)
      splitAt = i + 1
    } else if (line.trim() === '') {
      continue
    } else {
      break
    }
  }
  return {
    esm: esmLines.join('\n'),
    content: lines.slice(splitAt).join('\n').replace(/^\n+/, ''),
  }
}

/** Re-combine ESM lines with editor body */
export function combineEsmAndContent(esm: string, content: string): string {
  if (!esm) return content
  return esm + '\n\n' + content
}

/** Convert a frontmatter value to a display string for form inputs */
function toDisplayValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  return String(value)
}

interface Props {
  schema: FrontmatterFieldSchema[]
  frontmatter: FrontmatterData
  onChange: (data: FrontmatterData) => void
}

export default function FrontmatterEditor({
  schema,
  frontmatter,
  onChange,
}: Props) {
  return (
    <div className="flex flex-col gap-2 border-b border-border bg-surface px-5 py-4 text-ui">
      <FieldGroup
        schema={schema}
        data={frontmatter}
        onChange={onChange}
        depth={0}
      />
    </div>
  )
}

interface FieldGroupProps {
  schema: FrontmatterFieldSchema[]
  data: FrontmatterData
  onChange: (data: FrontmatterData) => void
  depth: number
}

function FieldGroup({ schema, data, onChange, depth }: FieldGroupProps) {
  const handleFieldChange = useCallback(
    (fieldName: string, fieldType: string, value: string) => {
      const updated = { ...data }
      if (fieldType === 'string-array') {
        updated[fieldName] = value
          ? value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []
      } else {
        updated[fieldName] = value
      }
      onChange(updated)
    },
    [data, onChange]
  )

  return (
    <>
      {schema.map((field) => {
        if (field.type === 'object' && field.children) {
          const nested = (data[field.name] ?? {}) as FrontmatterData
          return (
            <div
              key={field.name}
              className={depth > 0 ? 'ml-4 border-l border-border pl-3' : ''}
            >
              <div className="pt-2 pb-1 text-xs font-semibold text-text-muted">
                {formatLabel(field.name)}
              </div>
              <FieldGroup
                schema={field.children}
                data={nested}
                onChange={(updated) =>
                  onChange({ ...data, [field.name]: updated })
                }
                depth={depth + 1}
              />
            </div>
          )
        }
        if (field.type === 'json' && field.itemSchema) {
          const raw = data[field.name]
          const items = (Array.isArray(raw) ? raw : []) as FrontmatterData[]
          return (
            <ObjectArrayField
              key={field.name}
              name={field.name}
              items={items}
              itemSchema={field.itemSchema}
              onChange={(next) => onChange({ ...data, [field.name]: next })}
              depth={depth}
            />
          )
        }
        const raw = data[field.name]
        const arrayValue = Array.isArray(raw) ? raw.map(String) : []
        return (
          <div key={field.name}>
            <PropInput
              schema={field}
              value={toDisplayValue(raw)}
              onChange={(v) => handleFieldChange(field.name, field.type, v)}
              arrayValue={arrayValue}
              onChangeArray={(items) => {
                onChange({ ...data, [field.name]: items })
              }}
            />
          </div>
        )
      })}
    </>
  )
}

interface ObjectArrayFieldProps {
  name: string
  items: FrontmatterData[]
  itemSchema: FrontmatterFieldSchema[]
  onChange: (items: FrontmatterData[]) => void
  depth: number
}

function ObjectArrayField({
  name,
  items,
  itemSchema,
  onChange,
  depth,
}: ObjectArrayFieldProps) {
  const updateItem = (i: number, next: FrontmatterData) => {
    onChange(items.map((item, j) => (j === i ? next : item)))
  }
  const removeItem = (i: number) => {
    onChange(items.filter((_, j) => j !== i))
  }
  const addItem = () => {
    onChange([...items, {}])
  }
  return (
    <div className={depth > 0 ? 'ml-4 border-l border-border pl-3' : ''}>
      <div className="pt-2 pb-1 text-xs font-semibold text-text-muted">
        {formatLabel(name)}
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => (
          <div
            key={i}
            className="relative flex flex-col gap-1 rounded-md border border-border bg-surface-raised py-1.5 pl-2.5 pr-8"
          >
            <IconButton
              label="Remove item"
              size="sm"
              tone="danger"
              onClick={() => removeItem(i)}
              className="absolute top-1 right-1"
            >
              <TbX size={14} />
            </IconButton>
            <FieldGroup
              schema={itemSchema}
              data={item}
              onChange={(next) => updateItem(i, next)}
              depth={depth + 1}
            />
          </div>
        ))}
        <Button
          variant="dashed"
          size="sm"
          icon={<TbPlus size={14} />}
          onClick={addItem}
          className="self-start"
        >
          Add
        </Button>
      </div>
    </div>
  )
}
