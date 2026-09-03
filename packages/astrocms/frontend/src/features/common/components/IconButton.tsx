import React from 'react'

type Size = 'sm' | 'md'
type Tone = 'default' | 'danger' | 'accent'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: Size
  tone?: Tone
  active?: boolean
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
}

const toneClasses: Record<Tone, string> = {
  default:
    'text-text-muted enabled:hover:text-text enabled:hover:bg-surface-hover',
  danger:
    'text-text-muted enabled:hover:text-danger-text enabled:hover:bg-danger-soft',
  accent:
    'text-text-muted enabled:hover:text-accent-text enabled:hover:bg-accent-soft',
}

/** Square icon-only button. `label` doubles as tooltip and accessible name. */
export function IconButton({
  label,
  size = 'md',
  tone = 'default',
  active,
  className = '',
  children,
  ...props
}: Props) {
  const look = active
    ? 'bg-accent-soft text-accent-text'
    : toneClasses[tone]
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-md cursor-pointer transition-colors duration-150 disabled:cursor-default disabled:opacity-50 ${sizeClasses[size]} ${look} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
