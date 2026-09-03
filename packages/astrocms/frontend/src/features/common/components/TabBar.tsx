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
    <div role="tablist" className="flex gap-1 border-b border-border px-4">
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
            className={`-mb-px px-3 py-2 text-sm border-b-2 cursor-pointer bg-transparent ${
              selected
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
