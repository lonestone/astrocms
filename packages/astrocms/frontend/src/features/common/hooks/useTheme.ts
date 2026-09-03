import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'cms-theme'

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

// Module-level store so every component sees the same theme and re-renders
// together when it changes.
let current: Theme = readStored() ?? systemTheme()
const listeners = new Set<() => void>()

function apply(theme: Theme) {
  current = theme
  document.documentElement.dataset.theme = theme
  listeners.forEach((l) => l())
}

apply(current)

window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', (e) => {
    // Follow the system only while no explicit choice is stored.
    if (readStored()) return
    apply(e.matches ? 'dark' : 'light')
  })

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return current
}

/**
 * Light/dark theme. Follows the system preference until the user picks one
 * explicitly, then persists that choice.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
    apply(next)
  }, [])

  const toggle = useCallback(() => {
    setTheme(current === 'dark' ? 'light' : 'dark')
  }, [setTheme])

  return { theme, isDark: theme === 'dark', setTheme, toggle }
}
