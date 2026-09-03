import React, { useMemo, useState } from 'react'
import * as Flags from 'country-flag-icons/react/3x2'
import { LANG_TO_COUNTRY, getLangName } from '../../common/utils/langs.js'
import { Input } from '../../common/components/Input.js'

const FlagComponents = Flags as Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
>

interface Props {
  usedLangs: string[]
  onSelect: (lang: string) => void
}

export function LangPicker({ usedLangs, onSelect }: Props) {
  const used = useMemo(() => new Set(usedLangs), [usedLangs])
  const [query, setQuery] = useState('')

  const langs = useMemo(() => {
    const all = Object.keys(LANG_TO_COUNTRY).sort()
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter((lang) => {
      if (lang.includes(q)) return true
      return getLangName(lang).toLowerCase().includes(q)
    })
  }, [query])

  const firstEnabled = langs.find((l) => !used.has(l))

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && firstEnabled) {
            e.preventDefault()
            onSelect(firstEnabled)
          }
        }}
        placeholder="Search a language"
        aria-label="Search a language"
        autoFocus
      />
      {langs.length === 0 ? (
        <div className="py-6 text-center text-xs text-text-muted">
          No language matches
        </div>
      ) : (
        <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto pr-1">
          {langs.map((lang) => {
            const disabled = used.has(lang)
            const country = LANG_TO_COUNTRY[lang]
            const FlagIcon = country ? FlagComponents[country] : undefined
            return (
              <button
                key={lang}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(lang)}
                title={`${getLangName(lang)}${
                  disabled ? ' (already used)' : ''
                }`}
                className={`flex h-7 items-center gap-1.5 rounded-md border px-1.5 text-xs leading-none transition-colors duration-100 ${
                  disabled
                    ? 'border-transparent text-text-faint cursor-not-allowed'
                    : 'border-border cursor-pointer hover:border-accent hover:bg-accent-soft'
                }`}
              >
                {FlagIcon && (
                  <FlagIcon
                    className={`h-3 w-4 shrink-0 rounded-[2px] ${
                      disabled ? 'opacity-40' : ''
                    }`}
                  />
                )}
                <span>{lang}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
