import React from 'react'
import { TbSearch, TbX } from 'react-icons/tb'

interface Props {
  query: string
  onChange: (query: string) => void
}

export function SidebarSearch({ query, onChange }: Props) {
  return (
    <div className="sticky top-0 z-10 bg-surface px-2 pt-2 pb-1">
      <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface-raised px-2 transition-colors duration-150 hover:border-border-strong focus-within:border-accent focus-within:ring-2 focus-within:ring-ring">
        <TbSearch size={16} className="shrink-0 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              onChange('')
              ;(e.currentTarget as HTMLInputElement).blur()
            }
          }}
          placeholder="Search files"
          aria-label="Search files"
          className="m-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-ui text-text outline-none placeholder:text-text-faint"
        />
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          tabIndex={query ? 0 : -1}
          className={`rounded p-0.5 text-text-muted cursor-pointer hover:bg-surface-hover hover:text-text ${
            query ? '' : 'invisible'
          }`}
        >
          <TbX size={15} />
        </button>
      </div>
    </div>
  )
}
