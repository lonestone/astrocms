import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { TreeNode } from '../../../api.js'
import { getLocaleSiblings } from '../utils/folderTarget.js'
import {
  collectLocalesInTree,
  resolveEffectiveLang,
} from '../utils/locales.js'
import { stripExtension } from '../utils/supportedFiles.js'

const STORAGE_KEY = 'cms-current-lang'

interface ContextValue {
  /** Lang explicitly picked/last-opened by the user, or null. */
  currentLang: string | null
  /** Best lang to use (user pick, else "en", else first locale, else null). */
  effectiveLang: string | null
  setCurrentLang: (lang: string | null) => void
}

const CurrentLangContext = createContext<ContextValue | null>(null)

function loadInitial(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && v.length === 2) return v
  } catch {}
  return null
}

function getBrowserLang(): string | null {
  try {
    if (typeof navigator === 'undefined') return null
    const lang = navigator.language
    if (lang && lang.length >= 2) return lang.slice(0, 2).toLowerCase()
  } catch {}
  return null
}

interface Props {
  tree: TreeNode[]
  filePath: string | null
  children: React.ReactNode
}

export function CurrentLangProvider({ tree, filePath, children }: Props) {
  const [currentLang, setState] = useState<string | null>(loadInitial)

  const setCurrentLang = useCallback((lang: string | null) => {
    setState(lang)
    try {
      if (lang == null) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, lang)
    } catch {}
  }, [])

  // Adopt the language of the currently viewed file when it's one of a set
  // of locale siblings. Navigating to a non-locale file keeps the last pick.
  useEffect(() => {
    if (!filePath) return
    const siblings = getLocaleSiblings(tree, filePath)
    if (!siblings) return
    const fileName = filePath.split('/').pop() ?? ''
    const lang = stripExtension(fileName)
    if (lang.length === 2) setCurrentLang(lang)
  }, [tree, filePath, setCurrentLang])

  const availableLocales = useMemo(() => collectLocalesInTree(tree), [tree])
  const browserLang = useMemo(() => getBrowserLang(), [])
  const effectiveLang = useMemo(
    () => resolveEffectiveLang(availableLocales, currentLang, browserLang),
    [availableLocales, currentLang, browserLang]
  )

  const value = useMemo(
    () => ({ currentLang, effectiveLang, setCurrentLang }),
    [currentLang, effectiveLang, setCurrentLang]
  )

  return (
    <CurrentLangContext.Provider value={value}>
      {children}
    </CurrentLangContext.Provider>
  )
}

export function useCurrentLang(): ContextValue {
  const ctx = useContext(CurrentLangContext)
  if (!ctx) {
    throw new Error(
      'useCurrentLang must be used inside a CurrentLangProvider'
    )
  }
  return ctx
}
