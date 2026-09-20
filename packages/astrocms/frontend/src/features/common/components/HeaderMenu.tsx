import React, { useEffect, useRef, useState } from 'react'
import { TbDots, TbDownload } from 'react-icons/tb'
import {
  useGitBranch,
  useGitPull,
  useGitRemoteStatus,
} from '../../git/hooks/useGit.js'
import { IconButton } from './IconButton.js'
import { MenuItem } from './Menu.js'

export function HeaderMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const pull = useGitPull()
  const { data: remote } = useGitRemoteStatus()
  // PR-based edits: the base branch can't be pulled and working branches
  // auto-sync in the background, so this menu has nothing to offer — the
  // update affordance lives in the review UI (behindBase + update button).
  const { data: branch } = useGitBranch()
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

  if (branch?.prMode === true) return null

  function handlePull() {
    pull.mutate(undefined, {
      onSuccess: () => setOpen(false),
    })
  }

  return (
    <div ref={rootRef} className="relative">
      <IconButton
        label="More actions"
        aria-expanded={open}
        active={open}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <TbDots size={18} />
        {updateAvailable && (
          <span
            className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-warning"
            aria-hidden
          />
        )}
      </IconButton>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 w-64 popover-surface p-1 text-ui animate-pop-in"
        >
          <MenuItem
            onClick={handlePull}
            disabled={pull.isPending}
            icon={<TbDownload size={16} />}
            trailing={
              updateAvailable ? (
                <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning-text">
                  {remote?.behind} new
                </span>
              ) : undefined
            }
          >
            {pull.isPending ? 'Pulling from remote' : 'Pull from remote'}
          </MenuItem>
          {pull.error && (
            <div className="px-2 py-1.5 text-2xs text-danger-text">
              {pull.error.message}
            </div>
          )}
          {remote?.lastCheckedAt && (
            <div className="mt-1 border-t border-border px-2 pt-1.5 pb-1 text-2xs text-text-muted">
              Last check {new Date(remote.lastCheckedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
