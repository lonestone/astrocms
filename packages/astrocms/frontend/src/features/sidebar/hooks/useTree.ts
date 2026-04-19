import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { fetchTree } from '../../../api.js'
import { useSorts, DEFAULT_SORT } from './useFolderSort.js'

export function useTree() {
  const queryClient = useQueryClient()
  const sorts = useSorts()

  // Only send schema-field sorts to the server (filename sort is default).
  const sortParams = useMemo(() => {
    return Object.entries(sorts)
      .filter(([, s]) => s.field !== DEFAULT_SORT.field)
      .map(([folder, s]) => ({ folder, field: s.field }))
      .sort((a, b) => a.folder.localeCompare(b.folder))
  }, [sorts])

  const queryKey = useMemo(
    () => ['tree', sortParams.map((s) => `${s.folder}:${s.field}`).join(',')],
    [sortParams]
  )

  const { data: tree = [] } = useQuery({
    queryKey,
    queryFn: () => fetchTree(sortParams),
  })

  const invalidateTree = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tree'] })
  }, [queryClient])

  return { tree, invalidateTree }
}
