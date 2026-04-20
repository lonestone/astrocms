import React, { useMemo, useState } from 'react'
import * as Flags from 'country-flag-icons/react/3x2'
import { LANG_TO_COUNTRY, getLangName } from '../../common/utils/langs.js'

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
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && firstEnabled) {
            e.preventDefault()
            onSelect(firstEnabled)
          }
        }}
        placeholder="Search language..."
        autoFocus
        className="block w-full mb-2 px-2 py-1.5 border border-gray-300 rounded text-xs"
      />
      {langs.length === 0 ? (
        <div className="text-xs text-text-muted py-2 text-center">
          No language matches
        </div>
      ) : (
        <div className="grid grid-cols-6 gap-1 max-h-64 overflow-y-auto pr-1">
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
                className={`flex items-center gap-1 px-1.5 py-1 rounded text-xs leading-none border ${
                  disabled
                    ? 'border-transparent text-text-muted opacity-30 cursor-not-allowed'
                    : 'border-border hover:border-primary hover:bg-bg-main cursor-pointer'
                }`}
              >
                {FlagIcon && (
                  <FlagIcon className="w-4 h-3 rounded-sm shrink-0" />
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
