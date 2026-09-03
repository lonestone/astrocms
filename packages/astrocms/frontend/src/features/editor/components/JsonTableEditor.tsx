import React, { useMemo, useCallback } from 'react'
import type { PropSchema } from '../../../api.js'
import { TbPlus, TbX } from 'react-icons/tb'
import Button from '../../common/components/Button.js'
import { IconButton } from '../../common/components/IconButton.js'
import { inputClassName } from './PropInput.js'

// Parse JS expression (unquoted keys) or JSON into an array
function parseJsArray(value: string): Record<string, string>[] {
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed
  } catch {
    try {
      const parsed = new Function(`return ${value}`)()
      if (Array.isArray(parsed)) return parsed
    } catch {
      // ignore
    }
  }
  return []
}

// Serialize rows back as JS expression (unquoted keys, double-quoted values)
function serializeJsArray(rows: Record<string, string>[]): string {
  if (rows.length === 0) return '[]'
  const items = rows.map((row) => {
    const fields = Object.entries(row)
      .filter(([, v]) => v !== '')
      .map(
        ([k, v]) => `${k}: "${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      )
      .join(', ')
    return `  { ${fields} }`
  })
  return `[\n${items.join(',\n')}\n]`
}

interface Props {
  value: string
  schema: PropSchema[]
  onChange: (value: string) => void
}

export default function JsonTableEditor({ value, schema, onChange }: Props) {
  const rows = useMemo(() => parseJsArray(value), [value])

  const commit = useCallback(
    (newRows: Record<string, string>[]) => onChange(serializeJsArray(newRows)),
    [onChange]
  )

  const handleCellChange = useCallback(
    (rowIndex: number, field: string, cellValue: string) => {
      commit(
        rows.map((row, i) =>
          i === rowIndex ? { ...row, [field]: cellValue } : row
        )
      )
    },
    [rows, commit]
  )

  const handleAddRow = useCallback(() => {
    const empty = Object.fromEntries(schema.map((s) => [s.name, '']))
    commit([...rows, empty])
  }, [rows, schema, commit])

  const handleRemoveRow = useCallback(
    (index: number) => commit(rows.filter((_, i) => i !== index)),
    [rows, commit]
  )

  return (
    <div className="py-1">
      <table className="w-full border-collapse m-0! text-ui">
        <thead>
          <tr>
            {schema.map((s) => (
              <th
                key={s.name}
                className="border-b border-border px-1 py-1 text-left text-xs font-medium text-text-muted"
              >
                {s.name}
              </th>
            ))}
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {schema.map((s) => (
                <td key={s.name} className="px-1 py-0.5">
                  <input
                    type="text"
                    value={row[s.name] ?? ''}
                    onChange={(e) =>
                      handleCellChange(rowIndex, s.name, e.target.value)
                    }
                    className={`${inputClassName} w-full`}
                    style={{ flex: undefined }}
                  />
                </td>
              ))}
              <td className="py-0.5">
                <IconButton
                  label="Remove row"
                  size="sm"
                  tone="danger"
                  onClick={() => handleRemoveRow(rowIndex)}
                >
                  <TbX size={14} />
                </IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button
        variant="dashed"
        size="sm"
        icon={<TbPlus size={14} />}
        onClick={handleAddRow}
        className="mt-1.5"
      >
        Add row
      </Button>
    </div>
  )
}
