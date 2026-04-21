import React, { useState } from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { RiSparkling2Line } from 'react-icons/ri'
import { useQueryClient } from '@tanstack/react-query'
import Button from '../../common/components/Button.js'
import { useAgentRuntime } from '../../agent/contexts/AgentRuntimeContext.js'
import {
  useGitCommit,
  useGitDiffs,
  useGitStage,
  useGitStatus,
  useGitUnstage,
} from '../hooks/useGit.js'
import { GitReviewFile } from './GitReviewFile.js'

export function GitReview() {
  const queryClient = useQueryClient()
  const { data: files = [], isLoading } = useGitStatus()
  const { data: diffs = {} } = useGitDiffs()
  const commit = useGitCommit()
  const stage = useGitStage()
  const unstage = useGitUnstage()
  const { isAuthenticated, sendPrompt } = useAgentRuntime()

  const [message, setMessage] = useState('')

  const staged = files.filter((f) => f.staged)
  const stagedCount = staged.length
  const canCommit = message.trim().length > 0 && stagedCount > 0
  const allStaged = files.length > 0 && files.every((f) => f.staged)

  function handleToggleAll() {
    if (allStaged) {
      unstage.mutate(files.map((f) => f.path))
    } else {
      // Only send files that aren't already staged. Re-running `git add` on
      // an already-staged deletion, for instance, fails with "pathspec did
      // not match".
      const toStage = files.filter((f) => !f.staged).map((f) => f.path)
      if (toStage.length) stage.mutate(toStage)
    }
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['gitStatus'] })
    queryClient.invalidateQueries({ queryKey: ['gitDiffs'] })
  }

  async function handleCommit(push: boolean) {
    if (!canCommit) return
    try {
      await commit.mutateAsync({ message: message.trim(), push })
      setMessage('')
    } catch {
      // error exposed via commit.error
    }
  }

  function handleAutoCommit() {
    const list = staged.map((f) => `- ${f.path}`).join('\n')
    const prompt = [
      'Commit and push the following staged files.',
      '',
      'Files:',
      list || '(no staged files — stage the changes first)',
      '',
      'Write a concise conventional commit message that explains WHY, then run `git commit` and `git push`.',
    ].join('\n')
    sendPrompt(prompt)
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 overflow-auto px-6 pt-6 pb-40">
        <div className="pb-3 flex items-center gap-3">
          <h1 className="text-lg font-semibold">Review changes</h1>
          <span className="text-xs text-text-muted">
            {files.length} file{files.length === 1 ? '' : 's'} changed
            {stagedCount > 0 && ` · ${stagedCount} staged`}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded text-text-muted hover:text-text hover:bg-gray-100 cursor-pointer"
            aria-label="Refresh"
            tabIndex={0}
          >
            <FiRefreshCw size={14} />
          </button>
        </div>

        {files.length > 0 && (
          <div className="pb-4">
            <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allStaged}
                onChange={handleToggleAll}
                className="accent-primary w-4 h-4"
              />
              Include all
            </label>
          </div>
        )}

        {isLoading ? (
          <div className="text-xs text-text-muted py-10 text-center">
            Loading...
          </div>
        ) : files.length === 0 ? (
          <div className="text-sm text-text-muted py-16 text-center">
            Working tree is clean.
            <br />
            Nothing to commit.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {files.map((file) => (
              <GitReviewFile
                key={file.path}
                file={file}
                diff={diffs[file.path] ?? ''}
              />
            ))}
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="absolute left-0 right-0 bottom-0 z-20 border-t border-border bg-white px-6 py-3 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col gap-3 max-w-5xl mx-auto">
            {isAuthenticated && stagedCount > 0 && (
              <button
                type="button"
                onClick={handleAutoCommit}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-primary text-white hover:opacity-95 cursor-pointer shadow-md"
                aria-label="Let AI commit and push"
                tabIndex={0}
              >
                <RiSparkling2Line size={16} />
                <span className="font-semibold text-sm">
                  Let AI commit &amp; push ({stagedCount})
                </span>
              </button>
            )}
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && canCommit) {
                    e.preventDefault()
                    handleCommit(e.ctrlKey || e.metaKey)
                  }
                }}
                placeholder="Commit message..."
                className="flex-1 px-3 py-2 border border-border rounded-md text-sm outline-none focus:border-primary"
              />
              <Button
                onClick={() => handleCommit(false)}
                disabled={!canCommit || commit.isPending}
              >
                {commit.isPending ? '...' : `Commit (${stagedCount})`}
              </Button>
              <Button
                variant="success"
                onClick={() => handleCommit(true)}
                disabled={!canCommit || commit.isPending}
              >
                Commit &amp; push
              </Button>
            </div>
            {commit.error && (
              <div className="text-xs text-danger">{commit.error.message}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
