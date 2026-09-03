import React from 'react'

/** Shared look for text inputs, selects and textareas. */
export const inputClass =
  'w-full min-w-0 rounded-md border border-border bg-surface-raised px-3 py-2 text-ui text-text placeholder:text-text-faint outline-none transition-colors duration-150 hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-ring disabled:bg-surface disabled:text-text-muted'

export const inputCompactClass =
  'w-full min-w-0 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-text placeholder:text-text-faint outline-none transition-colors duration-150 hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-ring disabled:bg-surface disabled:text-text-muted'

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  compact?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, Props>(function Input(
  { compact, className = '', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={`${compact ? inputCompactClass : inputClass} ${className}`}
      {...props}
    />
  )
})

interface FieldProps {
  label: React.ReactNode
  htmlFor?: string
  hint?: React.ReactNode
  error?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Label above input, optional hint and error below. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = '',
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-text-secondary"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger-text">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
