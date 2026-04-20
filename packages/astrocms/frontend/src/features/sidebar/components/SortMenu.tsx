import React, { useEffect, useRef } from 'react'
import { MdArrowUpward, MdArrowDownward, MdCheck } from 'react-icons/md'
import type { FrontmatterFieldSchema } from '../../../api.js'
import {
  DEFAULT_SORT,
  type FolderSort,
} from '../hooks/useFolderSort.js'

interface Props {
  x: number
  y: number
  schema: FrontmatterFieldSchema[] | undefined
  current: FolderSort
  onChange: (sort: FolderSort) => void
  onClose: () => void
}

interface SortOption {
  field: string
  label: string
}

function flattenFields(
  fields: FrontmatterFieldSchema[],
  prefix = ''
): SortOption[] {
  const out: SortOption[] = []
  for (const f of fields) {
    const field = prefix ? `${prefix}.${f.name}` : f.name
    if (f.type === 'object' && f.children) {
      out.push(...flattenFields(f.children, field))
    } else if (
      f.type === 'string' ||
      f.type === 'number' ||
      f.type === 'boolean' ||
      f.type === 'date' ||
      f.type === 'select'
    ) {
      out.push({ field, label: field })
    }
  }
  return out
}

export function SortMenu({ x, y, schema, current, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const options: SortOption[] = [
    { field: DEFAULT_SORT.field, label: 'Filename' },
    ...(schema ? flattenFields(schema) : []),
  ]

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1000
  const menuW = 220
  const menuH = options.length * 28 + 8
  const left = Math.min(x, vw - menuW - 8)
  const top = Math.min(y, vh - menuH - 8)

  return (
    <div
      ref={ref}
      className="fixed z-9999 bg-white border border-border rounded-md shadow-lg py-1 text-xs"
      style={{ left, top, width: menuW }}
    >
      {options.map((opt) => {
        const isActive = current.field === opt.field
        const setDir = (dir: 'asc' | 'desc') => {
          if (isActive && current.order === dir) onChange(DEFAULT_SORT)
          else onChange({ field: opt.field, order: dir })
          onClose()
        }
        const cycleFromRow = () => {
          if (!isActive) onChange({ field: opt.field, order: 'asc' })
          else if (current.order === 'asc')
            onChange({ field: opt.field, order: 'desc' })
          else onChange(DEFAULT_SORT)
          onClose()
        }
        return (
          <div
            key={opt.field}
            role="button"
            tabIndex={0}
            onClick={cycleFromRow}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                cycleFromRow()
              }
            }}
            className={`flex items-center justify-between px-2 py-1 gap-1 cursor-pointer hover:bg-bg-main ${
              isActive ? 'bg-bg-main' : ''
            }`}
          >
            <span className="truncate flex items-center gap-1">
              {isActive ? (
                <MdCheck className="w-3.5 h-3.5 text-primary shrink-0" />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              {opt.label}
            </span>
            <span className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setDir('asc')
                }}
                aria-label="Sort ascending"
                className={`p-0.5 rounded cursor-pointer hover:bg-border ${
                  isActive && current.order === 'asc'
                    ? 'text-primary'
                    : 'text-text-muted'
                }`}
              >
                <MdArrowDownward className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setDir('desc')
                }}
                aria-label="Sort descending"
                className={`p-0.5 rounded cursor-pointer hover:bg-border ${
                  isActive && current.order === 'desc'
                    ? 'text-primary'
                    : 'text-text-muted'
                }`}
              >
                <MdArrowUpward className="w-3.5 h-3.5" />
              </button>
            </span>
          </div>
        )
      })}
    </div>
  )
}
