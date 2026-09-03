import React, { useState } from 'react'
import { TbGitCommit, TbRefresh, TbSparkles } from 'react-icons/tb'
import { useQueryClient } from '@tanstack/react-query'
import Button from '../../common/components/Button.js'
import { IconButton } from '../../common/components/IconButton.js'
import { inputClass } from '../../common/components/Input.js'
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
  const { isAuthenticated, sendInNewConversation, isRunning } =
    useAgentRuntime()

  const [message, setMessage] = useState('')

  const staged = files.filter((f) => f.staged)
  const stagedCount = staged.length
  const canCommit = message.trim().length > 0 && stagedCount > 0
  const allStaged = files.length > 0 && files.every((f) => f.staged)
  const someStaged = stagedCount > 0 && !allStaged

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
    if (isRunning) return
    const prompt =
      'Commit the staged files with a concise conventional commit message that explains WHY, then push.'
    // Always open a fresh conversation so prior context doesn't bleed in
    // and each publish gets its own session on the backend.
    sendInNewConversation(prompt)
  }

  const canAutoPublish = isAuthenticated && stagedCount > 0

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex-1 overflow-auto px-6 pt-5 pb-44">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold tracking-tight">
                Review changes
              </h1>
              <p className="text-xs text-text-muted">
                {isLoading
                  ? 'Checking the working tree'
                  : files.length === 0
                    ? 'Everything is published.'
                    : `${files.length} file${files.length === 1 ? '' : 's'} changed, ${stagedCount} selected to publish`}
              </p>
            </div>
            {files.length > 0 && (
              <label className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-md border border-border bg-surface-raised px-3 text-ui font-medium text-text transition-colors hover:bg-surface-hover">
                <input
                  type="checkbox"
                  checked={allStaged}
                  ref={(el) => {
                    if (el) el.indeterminate = someStaged
                  }}
                  onChange={handleToggleAll}
                  className="h-3.5 w-3.5 accent-accent"
                />
                Select all
              </label>
            )}
            <IconButton label="Refresh" onClick={handleRefresh}>
              <TbRefresh size={16} />
            </IconButton>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-4" aria-busy="true">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-panel border border-border bg-surface-raised"
                >
                  <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
                    <span className="skeleton h-3.5 w-3.5" />
                    <span className="skeleton h-4 w-16 rounded-full" />
                    <span className="skeleton h-3 w-48" />
                  </div>
                  <div className="flex flex-col gap-2 px-4 py-3">
                    <span className="skeleton h-3 w-3/4" />
                    <span className="skeleton h-3 w-1/2" />
                    <span className="skeleton h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-border-strong py-16 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-panel bg-success-soft text-success-text">
                <TbGitCommit size={20} />
              </span>
              <div>
                <p className="text-sm font-medium text-text">
                  Working tree is clean
                </p>
                <p className="text-xs text-text-muted">
                  Edits you make will show up here, ready to publish.
                </p>
              </div>
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
      </div>

      {files.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-border bg-surface-raised px-6 py-3 shadow-bar">
          <div className="mx-auto flex max-w-5xl flex-col gap-2">
            {canAutoPublish && (
              <Button
                variant="primary"
                size="lg"
                onClick={handleAutoCommit}
                disabled={isRunning}
                icon={<TbSparkles size={16} />}
                title="The agent writes the commit message and pushes"
                className="w-full"
              >
                {isRunning
                  ? 'Agent is publishing'
                  : `Publish ${stagedCount} file${stagedCount === 1 ? '' : 's'} with the agent`}
              </Button>
            )}
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && canCommit) {
                    e.preventDefault()
                    handleCommit(true)
                  }
                }}
                placeholder={
                  canAutoPublish
                    ? 'Or write your own commit message'
                    : stagedCount === 0
                      ? 'Select at least one file to publish'
                      : 'Commit message'
                }
                aria-label="Commit message"
                className={inputClass}
              />
              <Button
                variant={canAutoPublish ? 'outline' : 'primary'}
                size="lg"
                onClick={() => handleCommit(true)}
                disabled={!canCommit || commit.isPending}
                title="Commit and push"
                className="shrink-0"
              >
                {commit.isPending ? 'Publishing' : 'Publish'}
              </Button>
            </div>
            {commit.error && (
              <div className="text-xs text-danger-text">
                {commit.error.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
