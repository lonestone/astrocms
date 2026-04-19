import React from 'react'
import { MdSearch, MdClose } from 'react-icons/md'

interface Props {
  query: string
  onChange: (query: string) => void
}

export function SidebarSearch({ query, onChange }: Props) {
  return (
    <div className="sticky top-0 z-10 bg-bg-panel px-2 pt-2 pb-1">
      <div className="flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 focus-within:border-primary">
        <MdSearch className="w-3.5 h-3.5 shrink-0 text-text-muted" />
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
          placeholder="Search…"
          aria-label="Search files"
          className="flex-1 min-w-0 m-0 p-0 border-0 bg-transparent text-xs outline-none"
        />
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          tabIndex={query ? 0 : -1}
          className={`p-0.5 rounded text-text-muted hover:bg-border cursor-pointer ${
            query ? '' : 'invisible'
          }`}
        >
          <MdClose className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
