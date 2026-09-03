import React from 'react'
import {
  TbCheck,
  TbSortAscending,
  TbSortDescending,
} from 'react-icons/tb'
import type { FrontmatterFieldSchema } from '../../../api.js'
import { type FolderSort } from '../hooks/useFolderSort.js'
import {
  FILENAME_FIELD,
  flatSelectableFields,
  isDateLikeField,
} from '../utils/collectionDefaults.js'
import { Menu, MenuLabel, MenuSeparator } from '../../common/components/Menu.js'

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

const rowClass =
  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left cursor-pointer text-ui text-text transition-colors duration-100 hover:bg-surface-hover'

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
  const options = buildOptions(schema)
  const rowH = 28
  const estimatedHeight = 24 * 2 + rowH * options.length * 2 + 24

  return (
    <Menu
      x={x}
      y={y}
      width={240}
      estimatedHeight={estimatedHeight}
      onClose={onClose}
    >
      <MenuLabel>Sort by</MenuLabel>
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
            role="menuitem"
            tabIndex={0}
            onClick={cycleFromRow}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                cycleFromRow()
              }
            }}
            className={`${rowClass} ${isActive ? 'bg-surface-hover' : ''}`}
          >
            <span className="inline-flex w-4 shrink-0 justify-center text-accent-text">
              {isActive && <TbCheck size={16} />}
            </span>
            <span className="min-w-0 flex-1 truncate">{opt.label}</span>
            <span className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setDir('asc')
                }}
                aria-label="Sort ascending"
                title="Ascending"
                className={`rounded p-0.5 cursor-pointer hover:bg-surface-active ${
                  isActive && currentSort.order === 'asc'
                    ? 'text-accent-text'
                    : 'text-text-muted'
                }`}
              >
                <TbSortAscending size={16} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setDir('desc')
                }}
                aria-label="Sort descending"
                title="Descending"
                className={`rounded p-0.5 cursor-pointer hover:bg-surface-active ${
                  isActive && currentSort.order === 'desc'
                    ? 'text-accent-text'
                    : 'text-text-muted'
                }`}
              >
                <TbSortDescending size={16} />
              </button>
            </span>
          </div>
        )
      })}
      <MenuSeparator />
      <MenuLabel>Display as</MenuLabel>
      {options.map((opt) => {
        const isActive = currentName === opt.field
        const pick = () => {
          onChangeName(opt.field)
          onClose()
        }
        return (
          <div
            key={`name-${opt.field}`}
            role="menuitem"
            tabIndex={0}
            onClick={pick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                pick()
              }
            }}
            className={`${rowClass} ${isActive ? 'bg-surface-hover' : ''}`}
          >
            <span className="inline-flex w-4 shrink-0 justify-center text-accent-text">
              {isActive && <TbCheck size={16} />}
            </span>
            <span className="min-w-0 flex-1 truncate">{opt.label}</span>
          </div>
        )
      })}
    </Menu>
  )
}
