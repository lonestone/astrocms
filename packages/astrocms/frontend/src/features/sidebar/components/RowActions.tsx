import React from 'react'
import { TbArrowsSort, TbDots, TbPlus } from 'react-icons/tb'

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
  onNewFile,
  onOpenSortMenu,
  onOpenActionsMenu,
}: Props) {
  const sortActive = !sortIsDefault
  const iconBase =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded cursor-pointer text-text-muted transition-colors duration-100 hover:bg-surface-active hover:text-text'
  const hidden = 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'

  return (
    <span className="absolute right-1 top-0 bottom-0 flex items-center gap-0.5">
      {isRealFolder && (
        <>
          <button
            type="button"
            aria-label="New file"
            title="New file"
            onClick={(e) => {
              e.stopPropagation()
              onNewFile()
            }}
            className={`${iconBase} ${hidden}`}
          >
            <TbPlus size={15} />
          </button>
          {showSort && (
            <button
              type="button"
              aria-label="Sort"
              title="Sort"
              onClick={onOpenSortMenu}
              className={`${iconBase} ${
                sortActive ? 'text-accent-text opacity-100' : hidden
              }`}
            >
              <TbArrowsSort size={15} />
            </button>
          )}
        </>
      )}
      <button
        type="button"
        aria-label="Actions"
        title="Actions"
        onClick={onOpenActionsMenu}
        className={`${iconBase} ${hidden}`}
      >
        <TbDots size={15} />
      </button>
    </span>
  )
}
