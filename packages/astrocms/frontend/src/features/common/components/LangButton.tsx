import React, { useMemo } from 'react'
import * as Flags from 'country-flag-icons/react/3x2'
import { LANG_TO_COUNTRY, getLangName } from '../utils/langs.js'

const FlagComponents = Flags as Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
>

interface Props {
  lang: string
  active: boolean
  onClick: () => void
}

/** One segment of the locale switcher shown in the editor header. */
export default function LangButton({ lang, active, onClick }: Props) {
  const country = LANG_TO_COUNTRY[lang]
  const FlagIcon = country ? FlagComponents[country] : undefined
  const label = useMemo(() => getLangName(lang), [lang])

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-ui leading-none cursor-pointer transition-colors duration-150 ${
        active
          ? 'bg-surface-raised text-text shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--c-border)]'
          : 'text-text-muted hover:text-text'
      }`}
    >
      {FlagIcon && <FlagIcon className="h-3 w-4 shrink-0 rounded-[2px]" />}
      <span>{label}</span>
    </button>
  )
}
