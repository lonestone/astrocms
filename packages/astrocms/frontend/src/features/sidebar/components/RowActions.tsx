import React from 'react'
import { MdAdd, MdSort, MdMoreHoriz } from 'react-icons/md'

interface Props {
  isRealFolder: boolean
  showSort: boolean
  sortIsDefault: boolean
  isSelected: boolean
  onNewFile: () => void
  onOpenSortMenu: (e: React.MouseEvent) => void
  onOpenActionsMenu: (e: React.MouseEvent) => void
}

export function RowActions({
  isRealFolder,
  showSort,
  sortIsDefault,
  isSelected,
  onNewFile,
  onOpenSortMenu,
  onOpenActionsMenu,
}: Props) {
  const sortActive = !sortIsDefault
  const iconBase = `w-4 h-4 p-0.5 rounded cursor-pointer shrink-0 ${
    isSelected ? 'hover:bg-white/20' : 'hover:bg-border'
  }`
  const mutedColor = isSelected ? 'text-white' : 'text-text-muted'

  return (
    <span className="absolute right-1 top-0 bottom-0 flex items-center gap-0.5">
      {isRealFolder && (
        <>
          <button
            type="button"
            aria-label="New file"
            onClick={(e) => {
              e.stopPropagation()
              onNewFile()
            }}
            className={`${iconBase} ${mutedColor} opacity-0 group-hover:opacity-100 focus:opacity-100`}
            title="New file"
          >
            <MdAdd className="w-full h-full" />
          </button>
          {showSort && (
            <button
              type="button"
              aria-label="Sort"
              onClick={onOpenSortMenu}
              className={`${iconBase} ${
                sortActive
                  ? isSelected
                    ? 'text-yellow-200 opacity-100'
                    : 'text-primary opacity-100'
                  : `${mutedColor} opacity-0 group-hover:opacity-100 focus:opacity-100`
              }`}
              title="Sort"
            >
              <MdSort className="w-full h-full" />
            </button>
          )}
        </>
      )}
      <button
        type="button"
        aria-label="Actions"
        onClick={onOpenActionsMenu}
        className={`${iconBase} ${mutedColor} opacity-0 group-hover:opacity-100 focus:opacity-100`}
        title="Actions"
      >
        <MdMoreHoriz className="w-full h-full" />
      </button>
    </span>
  )
}
