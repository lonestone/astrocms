import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchGitStatus,
  fetchGitDiffs,
  fetchGitRemoteStatus,
  gitCommit,
  gitDiscard,
  gitDiscardHunk,
  gitPull,
  gitStage,
  gitUnstage,
} from '../../../api.js'

export function useGitStatus() {
  return useQuery({
    queryKey: ['gitStatus'],
    queryFn: fetchGitStatus,
    select: (data) => data.files,
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
    queryFn: fetchGitStatus,
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

export function useGitStage() {
  const invalidate = useGitInvalidate()

  return useMutation({
    mutationFn: (paths: string[]) => gitStage(paths),
    onSuccess: invalidate,
  })
}

export function useGitUnstage() {
  const invalidate = useGitInvalidate()

  return useMutation({
    mutationFn: (paths: string[]) => gitUnstage(paths),
    onSuccess: invalidate,
  })
}
