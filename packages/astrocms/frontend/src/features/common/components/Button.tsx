import React from 'react'

type Variant = 'primary' | 'success' | 'danger' | 'outline' | 'ghost' | 'dashed'
type Size = 'sm' | 'md' | 'lg'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Toggle-style highlight (used for panel toggles). */
  active?: boolean
  icon?: React.ReactNode
}

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap select-none cursor-pointer transition-colors duration-150 enabled:active:translate-y-px disabled:cursor-default'

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-fg enabled:hover:bg-accent-hover disabled:bg-surface-active disabled:text-text-faint',
  success:
    'bg-success text-white enabled:hover:bg-success-hover disabled:bg-surface-active disabled:text-text-faint',
  danger:
    'bg-danger text-white enabled:hover:bg-danger-hover disabled:bg-surface-active disabled:text-text-faint',
  outline:
    'border border-border bg-surface-raised text-text enabled:hover:bg-surface-hover enabled:hover:border-border-strong disabled:text-text-faint',
  ghost:
    'bg-transparent text-text-secondary enabled:hover:bg-surface-hover enabled:hover:text-text disabled:text-text-faint',
  dashed:
    'border border-dashed border-border-strong bg-transparent text-text-muted enabled:hover:border-text-muted enabled:hover:text-text disabled:text-text-faint',
}

const activeClass =
  'bg-accent-soft text-accent-text border border-accent-soft-hover enabled:hover:bg-accent-soft-hover'

const sizeClasses: Record<Size, string> = {
  sm: 'h-7 px-2 text-xs',
  md: 'h-8 px-3 text-ui',
  lg: 'h-10 px-4 text-sm',
}

export default function Button({
  variant = 'outline',
  size = 'md',
  active,
  icon,
  className = '',
  children,
  ...props
}: Props) {
  const look = active ? activeClass : variantClasses[variant]
  return (
    <button
      type="button"
      className={`${base} ${sizeClasses[size]} ${look} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0 -ml-0.5 inline-flex">{icon}</span>}
      {children}
    </button>
  )
}
