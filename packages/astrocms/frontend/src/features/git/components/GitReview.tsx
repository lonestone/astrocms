import React, { useEffect, useState } from 'react'
import {
  TbAlertTriangle,
  TbExternalLink,
  TbGitBranch,
  TbGitCommit,
  TbGitPullRequest,
  TbLoader2,
  TbPlus,
  TbRefresh,
  TbSparkles,
} from 'react-icons/tb'
import { useQueryClient } from '@tanstack/react-query'
import { fetchGitStatus, type GitBranchInfo } from '../../../api.js'
import Button from '../../common/components/Button.js'
import { IconButton } from '../../common/components/IconButton.js'
import { inputClass } from '../../common/components/Input.js'
import { useAgentRuntime } from '../../agent/contexts/AgentRuntimeContext.js'
import {
  useGitBranch,
  useGitCommit,
  useGitDiffs,
  useGitPush,
  useGitStage,
  useGitStatus,
  useGitUnstage,
  useGitUpdateBranch,
} from '../hooks/useGit.js'
import { GitReviewFile } from './GitReviewFile.js'
import { GitBranchDialog } from './GitBranchDialog.js'

export function GitReview() {
  const queryClient = useQueryClient()
  const { data: files = [], isLoading } = useGitStatus()
  const { data: branch } = useGitBranch()
  const { data: diffs = {} } = useGitDiffs()
  const commit = useGitCommit()
  const stage = useGitStage()
  const unstage = useGitUnstage()
  const push = useGitPush()
  const updateBranch = useGitUpdateBranch()
  const { isAuthenticated, sendInNewConversation, isRunning } =
    useAgentRuntime()

  const prMode = branch?.prMode === true
  const onBaseBranch = branch?.onBaseBranch === true
  // On the base branch (PR mode) nothing can be committed or pushed.
  const lockedToBase = prMode && onBaseBranch

  const [message, setMessage] = useState('')
  const [prTitle, setPrTitle] = useState('')
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Offer the latest commit subject as the default PR title, but only while
  // the user hasn't typed their own.
  useEffect(() => {
    const subject = branch?.lastCommitSubject
    if (subject) setPrTitle((prev) => prev || subject)
  }, [branch?.lastCommitSubject])

  const staged = files.filter((f) => f.staged)
  const stagedCount = staged.length
  const canCommit = message.trim().length > 0 && stagedCount > 0 && !lockedToBase
  const allStaged = files.length > 0 && files.every((f) => f.staged)
  const someStaged = stagedCount > 0 && !allStaged

  // Push / PR state (PR mode, working branch only).
  const openPr = branch?.openPr ?? null
  const aheadOfBase = branch?.aheadOfBase ?? 0
  const unpushed = branch?.unpushed ?? 0
  // Push is actionable when there are commits not yet on the remote working
  // branch, or when the branch has content but no open PR yet (a push then
  // opens it). With an open PR and nothing unpushed there is nothing to do:
  // aheadOfBase alone can't drive this, it stays > 0 until the PR merges.
  const canPush =
    prMode && !onBaseBranch && aheadOfBase > 0 && (unpushed > 0 || !openPr)
  const pushNeedsTitle = canPush && !openPr
  const canDoPush = canPush && (!pushNeedsTitle || prTitle.trim().length > 0)

  // The bottom bar must stay visible when the tree is clean but there are
  // committed (unpushed) changes to push in PR mode.
  const showBottomBar = files.length > 0 || (prMode && !onBaseBranch && aheadOfBase > 0)

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

  async function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    try {
      // Force a fresh remote check on the backend: plain invalidation would
      // re-fetch /status, which serves cached PR state while the 60 s check
      // throttle is active (e.g. right after merging a PR on GitHub).
      await queryClient.fetchQuery({
        queryKey: ['gitStatus'],
        queryFn: () => fetchGitStatus(true),
      })
    } finally {
      setRefreshing(false)
    }
    queryClient.invalidateQueries({ queryKey: ['gitDiffs'] })
  }

  async function handleCommit() {
    if (!canCommit) return
    try {
      // Non-PR mode keeps the old commit-and-push behavior; PR mode commits
      // only; pushing is a separate, deliberate action that opens the PR.
      await commit.mutateAsync({ message: message.trim(), push: !prMode })
      setMessage('')
    } catch {
      // error exposed via commit.error
    }
  }

  async function handlePush() {
    if (!canDoPush) return
    try {
      await push.mutateAsync(prTitle.trim())
    } catch {
      // error exposed via push.error
    }
  }

  function handleAutoCommit() {
    if (isRunning || lockedToBase) return
    const prompt = prMode
      ? 'Commit the staged files with a concise conventional commit message that explains WHY.'
      : 'Commit the staged files with a concise conventional commit message that explains WHY, then push.'
    // Always open a fresh conversation so prior context doesn't bleed in
    // and each publish gets its own session on the backend.
    sendInNewConversation(prompt)
  }

  const canAutoPublish = isAuthenticated && stagedCount > 0 && !lockedToBase

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex-1 overflow-auto px-6 pt-5 pb-48">
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
                    ? prMode && !onBaseBranch && aheadOfBase > 0
                      ? openPr
                        ? unpushed > 0
                          ? 'All changes are committed. Push to update the pull request.'
                          : 'All changes are committed and pushed to the pull request.'
                        : 'All changes are committed. Push to open a pull request.'
                      : 'Everything is published.'
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
            <IconButton
              label="Refresh"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <TbLoader2 size={16} className="animate-spin" />
              ) : (
                <TbRefresh size={16} />
              )}
            </IconButton>
          </div>

          {prMode && branch && (
            <BranchBar
              branch={branch}
              dirty={files.length > 0}
              updatePending={updateBranch.isPending}
              updateError={updateBranch.error?.message}
              onUpdate={() => updateBranch.mutate()}
              onCreateBranch={() => setBranchDialogOpen(true)}
            />
          )}

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
                  {prMode && !onBaseBranch && aheadOfBase > 0
                    ? 'All changes are committed'
                    : 'Working tree is clean'}
                </p>
                <p className="text-xs text-text-muted">
                  {prMode && !onBaseBranch && aheadOfBase > 0
                    ? openPr
                      ? unpushed > 0
                        ? 'Push from the bar below to update the pull request.'
                        : 'All commits are on the open pull request.'
                      : 'Push from the bar below to open a pull request.'
                    : 'Edits you make will show up here, ready to publish.'}
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

      {showBottomBar && (
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-border bg-surface-raised px-6 py-3 shadow-bar">
          <div className="mx-auto flex max-w-5xl flex-col gap-2">
            {lockedToBase ? (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <TbAlertTriangle size={14} className="shrink-0 text-warning" />
                You're on the base branch. Create a working branch to commit and
                publish changes.
              </div>
            ) : (
              <>
                {canAutoPublish && (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleAutoCommit}
                    disabled={isRunning}
                    icon={<TbSparkles size={16} />}
                    title="The agent writes the commit message"
                    className="w-full"
                  >
                    {isRunning
                      ? 'Agent is committing'
                      : `Commit ${stagedCount} file${stagedCount === 1 ? '' : 's'} with the agent`}
                  </Button>
                )}

                <div className="flex gap-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && canCommit) {
                        e.preventDefault()
                        handleCommit()
                      }
                    }}
                    placeholder={
                      canAutoPublish
                        ? 'Or write your own commit message'
                        : stagedCount === 0
                          ? 'Select at least one file to commit'
                          : 'Commit message'
                    }
                    aria-label="Commit message"
                    className={inputClass}
                  />
                  <Button
                    variant={canAutoPublish ? 'outline' : 'primary'}
                    size="lg"
                    onClick={() => handleCommit()}
                    disabled={!canCommit || commit.isPending}
                    title={prMode ? 'Commit (no push)' : 'Commit and push'}
                    className="shrink-0"
                  >
                    {commit.isPending
                      ? prMode
                        ? 'Committing'
                        : 'Publishing'
                      : prMode
                        ? 'Commit'
                        : 'Publish'}
                  </Button>
                </div>

                {prMode && !onBaseBranch && (
                  openPr ? (
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs text-text-muted">
                        Open PR #{openPr.number} · {openPr.title}
                      </span>
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => handlePush()}
                        disabled={!canDoPush || push.isPending}
                        title="Push to the open pull request"
                        className="shrink-0"
                      >
                        {push.isPending ? 'Pushing' : 'Push'}
                      </Button>
                    </div>
                  ) : aheadOfBase > 0 ? (
                    <div className="flex gap-2">
                      <input
                        value={prTitle}
                        onChange={(e) => setPrTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && canDoPush) {
                            e.preventDefault()
                            handlePush()
                          }
                        }}
                        placeholder="Pull request title"
                        aria-label="Pull request title"
                        className={inputClass}
                      />
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={() => handlePush()}
                        disabled={!canDoPush || push.isPending}
                        title="Push and open a pull request"
                        className="shrink-0"
                      >
                        {push.isPending ? 'Pushing' : 'Push & open PR'}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-text-muted">
                      Commit changes, then push to open a pull request.
                    </div>
                  )
                )}

                {commit.error && (
                  <div className="text-xs text-danger-text">
                    {commit.error.message}
                  </div>
                )}
                {push.error && (
                  <div className="text-xs text-danger-text">
                    {push.error.message}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {branchDialogOpen && branch && (
        <GitBranchDialog
          baseBranch={branch.baseBranch}
          onClose={() => setBranchDialogOpen(false)}
        />
      )}
    </div>
  )
}

interface BranchBarProps {
  branch: GitBranchInfo
  dirty: boolean
  updatePending: boolean
  updateError?: string
  onUpdate: () => void
  onCreateBranch: () => void
}

/**
 * Git + PR state strip (PR-based edits): the current branch, ahead/behind
 * badges with an update action, and the open PR (or a hint to push). On the
 * base branch it turns into a warning with a "Create branch" affordance.
 */
function BranchBar({
  branch,
  dirty,
  updatePending,
  updateError,
  onUpdate,
  onCreateBranch,
}: BranchBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-panel border border-border bg-surface-raised px-3 py-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          branch.onBaseBranch
            ? 'bg-warning-soft text-warning-text'
            : 'bg-accent-soft text-accent-text'
        }`}
      >
        <TbGitBranch size={13} />
        {branch.currentBranch || '(detached)'}
      </span>

      {branch.onBaseBranch ? (
        <>
          <span className="inline-flex items-center gap-1 text-xs text-warning-text">
            <TbAlertTriangle size={14} />
            You're on the base branch. Create a working branch to publish.
          </span>
          <Button
            size="sm"
            variant="primary"
            onClick={onCreateBranch}
            icon={<TbPlus size={14} />}
          >
            Create branch
          </Button>
        </>
      ) : (
        <>
          {branch.aheadOfBase > 0 && (
            <span className="rounded-full bg-surface-inset px-2 py-0.5 text-xs font-medium text-text-secondary">
              {branch.aheadOfBase} ahead
            </span>
          )}
          {branch.behindBase > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text">
                {branch.behindBase} behind {branch.baseBranch}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={onUpdate}
                disabled={updatePending || dirty}
                title={dirty ? 'Commit or discard changes first' : undefined}
              >
                {updatePending ? 'Updating…' : `Update from ${branch.baseBranch}`}
              </Button>
            </span>
          )}

          {branch.openPr ? (
            <a
              href={branch.openPr.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-1 text-xs font-medium text-accent-text hover:underline"
            >
              <TbGitPullRequest size={14} className="shrink-0" />
              <span className="truncate">
                PR #{branch.openPr.number} · {branch.openPr.title}
              </span>
              <TbExternalLink size={12} className="shrink-0" />
            </a>
          ) : branch.aheadOfBase > 0 ? (
            <span className="text-xs text-text-muted">
              Push to open a pull request
            </span>
          ) : null}

          {branch.openPrError && (
            <span className="text-xs text-danger-text">
              {branch.openPrError}
            </span>
          )}

          {updateError && (
            <span className="text-xs text-danger-text">{updateError}</span>
          )}
        </>
      )}
    </div>
  )
}
