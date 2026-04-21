import React, { useState } from 'react'

interface Props {
  children: React.ReactElement
  content: React.ReactNode
  side?: 'top' | 'bottom'
  className?: string
}

export function Tooltip({ children, content, side = 'top', className }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <span
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={`absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-text text-white text-[11px] font-normal whitespace-nowrap pointer-events-none z-50 ${
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          {content}
        </span>
      )}
    </span>
  )
}
