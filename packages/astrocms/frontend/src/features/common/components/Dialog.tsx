import React, { useEffect } from 'react'
import { TbX } from 'react-icons/tb'
import { IconButton } from './IconButton.js'

type Width = 'sm' | 'md' | 'lg'

interface Props {
  title: React.ReactNode
  /** Small text under the title. */
  description?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  /** Footer actions, right-aligned. */
  footer?: React.ReactNode
  width?: Width
  /** Extra controls in the header, next to the close button. */
  headerActions?: React.ReactNode
  /** Removes body padding (for tabbed or scrolling content). */
  flush?: boolean
  className?: string
}

const widthClasses: Record<Width, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

/**
 * Modal shell shared by every dialog: overlay, panel, header, footer.
 * Escape and overlay click both close it.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
  footer,
  width = 'sm',
  headerActions,
  flush,
  className = '',
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-overlay p-4 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex w-full flex-col overflow-hidden rounded-panel bg-surface-raised shadow-dialog animate-pop-in ${widthClasses[width]} ${className}`}
      >
        <div className="flex items-start gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-text">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-ui text-text-muted">{description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 -mr-1.5 -mt-1">
            {headerActions}
            <IconButton label="Close" onClick={onClose}>
              <TbX size={18} />
            </IconButton>
          </div>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-auto ${flush ? '' : 'px-5 pb-4'}`}
        >
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
