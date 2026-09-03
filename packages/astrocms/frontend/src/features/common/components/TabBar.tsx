import React from 'react'

export interface TabItem<K extends string = string> {
  key: K
  label: string
  title?: string
}

interface Props<K extends string> {
  tabs: TabItem<K>[]
  active: K
  onSelect: (key: K) => void
}

export function TabBar<K extends string>({ tabs, active, onSelect }: Props<K>) {
  return (
    <div role="tablist" className="flex gap-4 border-b border-border px-5">
      {tabs.map((tab) => {
        const selected = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            title={tab.title}
            onClick={() => onSelect(tab.key)}
            className={`-mb-px border-b-2 py-2.5 text-ui font-medium cursor-pointer transition-colors duration-150 ${
              selected
                ? 'border-accent text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
