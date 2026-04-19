import { useCallback, useEffect, useState } from 'react'

/**
 * Tracks which folders are open in the sidebar tree.
 *
 * Opening rules:
 * - Navigating to a file adds its ancestors to the open set (reveals the file).
 * - The open set is never pruned automatically: once a folder is open, it
 *   stays open until the user explicitly collapses it.
 * - Toggling a folder flips its state.
 */
export function useOpenFolders(selectedFile: string | null) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(() =>
    ancestorsOf(selectedFile)
  )

  useEffect(() => {
    const ancestors = ancestorsOf(selectedFile)
    if (ancestors.size === 0) return
    setOpenFolders((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const a of ancestors) {
        if (!next.has(a)) {
          next.add(a)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [selectedFile])

  const toggleFolder = useCallback((path: string) => {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  return { openFolders, toggleFolder }
}

function ancestorsOf(filePath: string | null): Set<string> {
  const out = new Set<string>()
  if (!filePath) return out
  const parts = filePath.split('/')
  for (let i = 1; i < parts.length; i++) {
    out.add(parts.slice(0, i).join('/'))
  }
  return out
}
