import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createFile,
  renameFile,
  duplicateFile,
  deleteFile,
} from '../../../api.js'

export function useFileOps() {
  const qc = useQueryClient()

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['tree'] })
    qc.invalidateQueries({ queryKey: ['folderMeta'] })
    qc.invalidateQueries({ queryKey: ['gitStatus'] })
  }

  async function throwIfError<T extends { ok: boolean; error?: string }>(
    p: Promise<T>
  ): Promise<T> {
    const r = await p
    if (!r.ok) throw new Error(r.error ?? 'Operation failed')
    return r
  }

  const create = useMutation({
    mutationFn: ({ path, content }: { path: string; content?: string }) =>
      throwIfError(createFile(path, content)),
    onSuccess: invalidate,
  })

  const rename = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      throwIfError(renameFile(from, to)),
    onSuccess: invalidate,
  })

  const duplicate = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      throwIfError(duplicateFile(from, to)),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: ({ path }: { path: string }) =>
      throwIfError(deleteFile(path)),
    onSuccess: invalidate,
  })

  return { create, rename, duplicate, remove }
}
