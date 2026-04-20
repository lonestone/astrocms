import { useCallback, useSyncExternalStore } from 'react'

export interface FolderSort {
  field: string
  order: 'asc' | 'desc'
}

export const DEFAULT_SORT: FolderSort = { field: '__filename', order: 'asc' }

const STORAGE_PREFIX = 'cms-sort:'

// ---------------------------------------------------------------------------
// Subscribable store, backed by localStorage
// ---------------------------------------------------------------------------

type Sorts = Record<string, FolderSort>

function loadAll(): Sorts {
  const out: Sorts = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue
      const path = key.slice(STORAGE_PREFIX.length)
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        if (
          parsed &&
          typeof parsed.field === 'string' &&
          (parsed.order === 'asc' || parsed.order === 'desc')
        ) {
          out[path] = parsed
        }
      } catch {}
    }
  } catch {}
  return out
}

let state: Sorts = loadAll()
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

function getSnapshot(): Sorts {
  return state
}

function writeOne(path: string, sort: FolderSort | null) {
  const next = { ...state }
  if (sort === null) {
    delete next[path]
    try {
      localStorage.removeItem(STORAGE_PREFIX + path)
    } catch {}
  } else {
    next[path] = sort
    try {
      localStorage.setItem(STORAGE_PREFIX + path, JSON.stringify(sort))
    } catch {}
  }
  state = next
  emit()
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Returns the current {folderPath → saved sort} map. */
export function useSorts(): Sorts {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Per-folder sort with a schema-aware fallback. When the user hasn't picked
 * anything, `sort` reflects `smartDefault` (or filename asc). `clearSort()`
 * removes any saved pick so the fallback resumes.
 */
export function useFolderSort(
  folderPath: string,
  smartDefault?: FolderSort
) {
  const sorts = useSorts()
  const saved = sorts[folderPath] ?? null
  const sort = saved ?? smartDefault ?? DEFAULT_SORT

  const setSort = useCallback(
    (next: FolderSort) => writeOne(folderPath, next),
    [folderPath]
  )
  const clearSort = useCallback(() => writeOne(folderPath, null), [folderPath])

  return { sort, setSort, clearSort, isDefault: saved === null }
}
