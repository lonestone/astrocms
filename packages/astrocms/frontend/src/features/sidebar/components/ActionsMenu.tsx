import React, { useEffect, useRef } from 'react'

export interface ActionItem {
  label: string
  onClick: () => void
  danger?: boolean
  icon?: React.ReactNode
}

interface Props {
  items: ActionItem[]
  x: number
  y: number
  onClose: () => void
}

export function ActionsMenu({ items, x, y, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
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

  // Clamp to viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1000
  const menuW = 180
  const menuH = items.length * 28 + 8
  const left = Math.min(x, vw - menuW - 8)
  const top = Math.min(y, vh - menuH - 8)

  return (
    <div
      ref={ref}
      className="fixed z-9999 bg-white border border-border rounded-md shadow-lg py-1 text-xs"
      style={{ left, top, width: menuW }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={`w-full text-left px-3 py-1.5 cursor-pointer flex items-center gap-2 ${
            item.danger
              ? 'text-danger hover:bg-red-50'
              : 'text-text hover:bg-bg-main'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
