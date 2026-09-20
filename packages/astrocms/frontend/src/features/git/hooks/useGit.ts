import { useEffect, useRef } from 'react'
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import {
  fetchGitStatus,
  fetchGitDiffs,
  fetchGitRemoteStatus,
  gitCommit,
  gitCreateBranch,
  gitDiscard,
  gitDiscardHunk,
  gitPull,
  gitPush,
  gitStage,
  gitUnstage,
  gitUpdateBranch,
  type GitStatusResponse,
} from '../../../api.js'

/**
 * How often the review UI re-polls git status. Mutations already invalidate
 * the query immediately; this interval covers changes that happen outside the
 * CMS (e.g. someone pushes to the base branch → "N behind" badge) and keeps
 * the open-PR state fresh after background remote checks.
 */
const GIT_STATUS_REFETCH_MS = 30_000

/**
 * react-query calls queryFn with its own context object, which would land in
 * `fetchGitStatus`'s `force` parameter and make every poll wait on a fresh
 * remote check, bypassing the backend throttle. Wrapping keeps polls unforced;
 * the review UI's refresh button is the only caller that forces a check.
 */
const gitStatusQueryFn = () => fetchGitStatus()

export function useGitStatus() {
  return useQuery({
    queryKey: ['gitStatus'],
    queryFn: gitStatusQueryFn,
    refetchInterval: GIT_STATUS_REFETCH_MS,
    select: (data) => data.files,
  })
}

/** Git + PR state from /status; undefined when PR-based edits are off. */
export function useGitBranch() {
  return useQuery({
    queryKey: ['gitStatus'],
    queryFn: gitStatusQueryFn,
    refetchInterval: GIT_STATUS_REFETCH_MS,
    select: (data) => data.branch,
  })
}

/**
 * When the backend auto-pulls a new remote commit during a status call,
 * `remote.lastPulledAt` ticks. Mount this hook once (at the Layout level)
 * so that file/tree caches get invalidated automatically.
 */
export function useGitRemoteSync() {
  const queryClient = useQueryClient()
  const previous = useRef<number | null | undefined>(undefined)

  const { data: lastPulledAt } = useQuery({
    queryKey: ['gitStatus'],
    queryFn: gitStatusQueryFn,
    refetchInterval: GIT_STATUS_REFETCH_MS,
    select: (data) => data.remote?.lastPulledAt ?? null,
  })

  useEffect(() => {
    if (previous.current !== undefined && lastPulledAt !== previous.current) {
      queryClient.invalidateQueries({ queryKey: ['tree'] })
      queryClient.invalidateQueries({ queryKey: ['file'] })
      queryClient.invalidateQueries({ queryKey: ['folderMeta'] })
      queryClient.invalidateQueries({ queryKey: ['gitDiffs'] })
    }
    previous.current = lastPulledAt
  }, [lastPulledAt, queryClient])
}

export function useGitDiffs() {
  return useQuery({
    queryKey: ['gitDiffs'],
    queryFn: fetchGitDiffs,
    select: (data) => data.diffs,
  })
}

export function useGitRemoteStatus() {
  return useQuery({
    queryKey: ['gitRemoteStatus'],
    queryFn: fetchGitRemoteStatus,
  })
}

function useGitInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['gitStatus'] })
    queryClient.invalidateQueries({ queryKey: ['gitDiffs'] })
    queryClient.invalidateQueries({ queryKey: ['gitRemoteStatus'] })
  }
}

export function useGitCommit() {
  const invalidate = useGitInvalidate()

  return useMutation({
    mutationFn: async ({
      message,
      push,
    }: {
      message: string
      push?: boolean
    }) => {
      const result = await gitCommit(message, push)
      if (!result.ok) throw new Error(result.error || 'Commit failed')
      return result
    },
    onSuccess: invalidate,
  })
}

export function useGitPull() {
  const invalidate = useGitInvalidate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const result = await gitPull()
      if (!result.ok) throw new Error(result.error || 'Pull failed')
      return result
    },
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['tree'] })
    },
  })
}

export function useGitDiscard() {
  const invalidate = useGitInvalidate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (path: string) => gitDiscard(path),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['tree'] })
    },
  })
}

export function useGitDiscardHunk() {
  const invalidate = useGitInvalidate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ path, hunk }: { path: string; hunk: string }) => {
      const result = await gitDiscardHunk(path, hunk)
      if (!result.ok) throw new Error(result.error || 'Discard hunk failed')
      return result
    },
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['tree'] })
    },
  })
}

/**
 * Optimistic stage/unstage: flip the staged flags in the gitStatus cache
 * immediately so checkboxes respond to clicks without waiting for the server
 * round-trip. Returns the previous cache snapshot so onError can roll back.
 */
async function optimisticStaged(
  queryClient: QueryClient,
  staged: boolean,
  paths: string[]
) {
  await queryClient.cancelQueries({ queryKey: ['gitStatus'] })
  const previous = queryClient.getQueryData<GitStatusResponse>(['gitStatus'])
  queryClient.setQueryData<GitStatusResponse>(['gitStatus'], (old) => {
    if (!old?.files) return old
    const set = new Set(paths)
    return {
      ...old,
      files: old.files.map((f) => (set.has(f.path) ? { ...f, staged } : f)),
    }
  })
  return { previous }
}

function restoreStaged(
  queryClient: QueryClient,
  context?: { previous?: GitStatusResponse }
) {
  if (context?.previous) queryClient.setQueryData(['gitStatus'], context.previous)
}

function settleGitQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['gitStatus'] })
  queryClient.invalidateQueries({ queryKey: ['gitDiffs'] })
}

export function useGitStage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (paths: string[]) => gitStage(paths),
    onMutate: (paths) => optimisticStaged(queryClient, true, paths),
    onError: (_err, _paths, context) => restoreStaged(queryClient, context),
    onSettled: () => settleGitQueries(queryClient),
  })
}

export function useGitUnstage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (paths: string[]) => gitUnstage(paths),
    onMutate: (paths) => optimisticStaged(queryClient, false, paths),
    onError: (_err, _paths, context) => restoreStaged(queryClient, context),
    onSettled: () => settleGitQueries(queryClient),
  })
}

export function useGitPush() {
  const invalidate = useGitInvalidate()

  return useMutation({
    mutationFn: async (title: string) => {
      const result = await gitPush(title)
      if (!result.ok) throw new Error(result.error || 'Push failed')
      return result
    },
    onSuccess: invalidate,
  })
}

export function useGitCreateBranch() {
  const invalidate = useGitInvalidate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const result = await gitCreateBranch(name)
      if (!result.ok) throw new Error(result.error || 'Could not create branch')
      return result
    },
    onSuccess: () => {
      invalidate()
      // Switching branches changes the working tree; refresh file caches.
      queryClient.invalidateQueries({ queryKey: ['tree'] })
    },
  })
}

export function useGitUpdateBranch() {
  const invalidate = useGitInvalidate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const result = await gitUpdateBranch()
      if (!result.ok) throw new Error(result.error || 'Could not update branch')
      return result
    },
    onSuccess: () => {
      invalidate()
      // The merge brings in base changes; refresh file caches.
      queryClient.invalidateQueries({ queryKey: ['tree'] })
    },
  })
}
