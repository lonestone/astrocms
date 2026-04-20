import React, { useEffect, useRef } from 'react'
import { MdArrowUpward, MdArrowDownward, MdCheck } from 'react-icons/md'
import type { FrontmatterFieldSchema } from '../../../api.js'
import { DEFAULT_SORT, type FolderSort } from '../hooks/useFolderSort.js'
import {
  FILENAME_FIELD,
  flatSelectableFields,
  isDateLikeField,
} from '../utils/collectionDefaults.js'

interface Props {
  x: number
  y: number
  schema: FrontmatterFieldSchema[] | undefined
  currentSort: FolderSort
  currentName: string
  onChangeSort: (sort: FolderSort | null) => void
  onChangeName: (name: string) => void
  onClose: () => void
}

interface FieldOption {
  field: string
  label: string
  /** Order to use on the first click that activates this field. */
  initialOrder: 'asc' | 'desc'
}

function buildOptions(
  schema: FrontmatterFieldSchema[] | undefined
): FieldOption[] {
  const base: FieldOption[] = [
    { field: FILENAME_FIELD, label: 'Filename', initialOrder: 'asc' },
  ]
  const fields = flatSelectableFields(schema).map((f) => ({
    field: f.path,
    label: f.path,
    initialOrder: isDateLikeField(f) ? ('desc' as const) : ('asc' as const),
  }))
  return [...base, ...fields]
}

export function SortMenu({
  x,
  y,
  schema,
  currentSort,
  currentName,
  onChangeSort,
  onChangeName,
  onClose,
}: Props) {
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

  const options = buildOptions(schema)

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1000
  const menuW = 240
  const headerRowH = 22
  const optionRowH = 28
  const menuH = headerRowH * 2 + optionRowH * options.length * 2 + 16
  const left = Math.min(x, vw - menuW - 8)
  const top = Math.min(y, vh - menuH - 8)

  return (
    <div
      ref={ref}
      className="fixed z-9999 bg-white border border-border rounded-md shadow-lg py-1 text-xs"
      style={{ left, top, width: menuW }}
    >
      <div className="px-2 pt-1 pb-0.5 text-2xs font-semibold uppercase tracking-wide text-text-muted">
        Sort by
      </div>
      {options.map((opt) => {
        const isActive = currentSort.field === opt.field
        const cycleFromRow = () => {
          if (!isActive) {
            onChangeSort({ field: opt.field, order: opt.initialOrder })
          } else if (currentSort.order === opt.initialOrder) {
            onChangeSort({
              field: opt.field,
              order: opt.initialOrder === 'asc' ? 'desc' : 'asc',
            })
          } else {
            onChangeSort(null)
          }
          onClose()
        }
        const setDir = (dir: 'asc' | 'desc') => {
          if (isActive && currentSort.order === dir) onChangeSort(null)
          else onChangeSort({ field: opt.field, order: dir })
          onClose()
        }
        return (
          <div
            key={`sort-${opt.field}`}
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
                  isActive && currentSort.order === 'asc'
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
                  isActive && currentSort.order === 'desc'
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
      <div className="my-1 border-t border-border" />
      <div className="px-2 pt-0.5 pb-0.5 text-2xs font-semibold uppercase tracking-wide text-text-muted">
        Display as
      </div>
      {options.map((opt) => {
        const isActive = currentName === opt.field
        const pick = () => {
          onChangeName(opt.field)
          onClose()
        }
        return (
          <div
            key={`name-${opt.field}`}
            role="button"
            tabIndex={0}
            onClick={pick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                pick()
              }
            }}
            className={`flex items-center px-2 py-1 gap-1 cursor-pointer hover:bg-bg-main ${
              isActive ? 'bg-bg-main' : ''
            }`}
          >
            {isActive ? (
              <MdCheck className="w-3.5 h-3.5 text-primary shrink-0" />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="truncate">{opt.label}</span>
          </div>
        )
      })}
    </div>
  )
}
