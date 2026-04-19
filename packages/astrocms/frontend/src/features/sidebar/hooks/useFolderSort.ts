import { useCallback, useSyncExternalStore } from 'react'

export interface FolderSort {
  field: string
  order: 'asc' | 'desc'
}

export const DEFAULT_SORT: FolderSort = { field: '__filename', order: 'asc' }

const STORAGE_PREFIX = 'cms-sort:'

function isDefaultSort(s: FolderSort): boolean {
  return s.field === DEFAULT_SORT.field && s.order === DEFAULT_SORT.order
}

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

function writeOne(path: string, sort: FolderSort) {
  const next = { ...state }
  if (isDefaultSort(sort)) {
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

/** Returns the current {folderPath → sort} map (non-default entries only). */
export function useSorts(): Sorts {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useFolderSort(folderPath: string) {
  const sorts = useSorts()
  const sort = sorts[folderPath] ?? DEFAULT_SORT

  const setSort = useCallback(
    (next: FolderSort) => writeOne(folderPath, next),
    [folderPath]
  )

  return { sort, setSort, isDefault: isDefaultSort(sort) }
}
