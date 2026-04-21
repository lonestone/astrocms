import React, { useEffect, useRef, useState } from 'react'
import { FiDownload, FiMoreHorizontal } from 'react-icons/fi'
import { useGitPull, useGitRemoteStatus } from '../../git/hooks/useGit.js'

export function HeaderMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const pull = useGitPull()
  const { data: remote } = useGitRemoteStatus()
  const updateAvailable = remote?.updateAvailable === true

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handlePull() {
    pull.mutate(undefined, {
      onSuccess: () => setOpen(false),
    })
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-expanded={open}
        tabIndex={0}
        className="relative p-1.5 rounded-md text-text-muted hover:bg-gray-100 hover:text-text cursor-pointer"
      >
        <FiMoreHorizontal size={16} />
        {updateAvailable && (
          <span
            className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500"
            aria-hidden
          />
        )}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-60 rounded-md border border-border bg-white shadow-lg py-1 z-50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handlePull}
            disabled={pull.isPending}
            tabIndex={0}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 disabled:opacity-50 disabled:cursor-default cursor-pointer"
          >
            <FiDownload size={13} className="text-text-muted" />
            <span className="flex-1">
              {pull.isPending ? 'Pulling...' : 'Pull from remote'}
            </span>
            {updateAvailable && (
              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                {remote?.behind} new
              </span>
            )}
          </button>
          {pull.error && (
            <div className="px-3 py-2 text-[11px] text-danger">
              {pull.error.message}
            </div>
          )}
          {remote?.lastCheckedAt && (
            <div className="px-3 py-1.5 text-[10px] text-text-muted border-t border-border mt-1">
              Last check: {new Date(remote.lastCheckedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
