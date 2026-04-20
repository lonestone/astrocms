import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_PREFIX = 'cms-name:'

type Names = Record<string, string>

function loadAll(): Names {
  const out: Names = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue
      const path = key.slice(STORAGE_PREFIX.length)
      const v = localStorage.getItem(key)
      if (v) out[path] = v
    }
  } catch {}
  return out
}

let state: Names = loadAll()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function getSnapshot(): Names {
  return state
}

function writeOne(path: string, name: string | null) {
  const next = { ...state }
  if (name === null) {
    delete next[path]
    try {
      localStorage.removeItem(STORAGE_PREFIX + path)
    } catch {}
  } else {
    next[path] = name
    try {
      localStorage.setItem(STORAGE_PREFIX + path, name)
    } catch {}
  }
  state = next
  emit()
}

/** Returns the current {folderPath → saved name field} map. */
export function useNames(): Names {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Per-folder display-name field with a schema-aware fallback. When the user
 * hasn't picked, `name` reflects `smartDefault` (e.g. "title" or "name").
 * Pass `FILENAME_FIELD` to mean "use the filename".
 */
export function useFolderName(folderPath: string, smartDefault: string) {
  const names = useNames()
  const saved = names[folderPath] ?? null
  const name = saved ?? smartDefault

  const setName = useCallback(
    (next: string) => writeOne(folderPath, next),
    [folderPath]
  )
  const clearName = useCallback(() => writeOne(folderPath, null), [folderPath])

  return { name, setName, clearName, isDefault: saved === null }
}
