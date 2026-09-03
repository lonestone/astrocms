import React from 'react'

interface Props {
  onMouseDown: (e: React.MouseEvent) => void
  side: 'left' | 'right'
}

export function ResizeHandle({ onMouseDown, side }: Props) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className={`group relative w-px shrink-0 cursor-col-resize bg-border ${
        side === 'left' ? '' : ''
      }`}
    >
      <div className="absolute inset-y-0 -left-1 w-2.5 transition-colors duration-150 group-hover:bg-accent/30 group-active:bg-accent/40" />
    </div>
  )
}
