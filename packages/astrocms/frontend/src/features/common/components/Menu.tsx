import React, { useEffect, useRef } from 'react'

interface MenuProps {
  /** Viewport coordinates of the anchor point. */
  x: number
  y: number
  width?: number
  /** Estimated height, used to keep the menu inside the viewport. */
  estimatedHeight?: number
  onClose: () => void
  children: React.ReactNode
  className?: string
}

/**
 * Floating menu surface positioned at a viewport point, clamped to stay on
 * screen. Closes on outside click and Escape.
 */
export function Menu({
  x,
  y,
  width = 200,
  estimatedHeight = 200,
  onClose,
  children,
  className = '',
}: MenuProps) {
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

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1000
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1000
  const left = Math.max(8, Math.min(x, vw - width - 8))
  const top = Math.max(8, Math.min(y, vh - estimatedHeight - 8))

  return (
    <div
      ref={ref}
      role="menu"
      className={`fixed z-[900] popover-surface p-1 text-ui animate-pop-in ${className}`}
      style={{ left, top, width }}
    >
      {children}
    </div>
  )
}

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  danger?: boolean
  active?: boolean
  /** Right-aligned slot (shortcut, badge, secondary controls). */
  trailing?: React.ReactNode
}

export function MenuItem({
  icon,
  danger,
  active,
  trailing,
  className = '',
  children,
  ...props
}: MenuItemProps) {
  const tone = danger
    ? 'text-danger-text hover:bg-danger-soft'
    : 'text-text hover:bg-surface-hover'
  return (
    <button
      type="button"
      role="menuitem"
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left cursor-pointer transition-colors duration-100 disabled:cursor-default disabled:opacity-50 ${tone} ${
        active ? 'bg-surface-hover' : ''
      } ${className}`}
      {...props}
    >
      {icon && (
        <span
          className={`inline-flex w-4 shrink-0 justify-center ${
            danger ? 'text-danger-text' : 'text-text-muted'
          }`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  )
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-1.5 pb-1 text-xs font-medium text-text-muted">
      {children}
    </div>
  )
}

export function MenuSeparator() {
  return <div className="my-1 border-t border-border" />
}
