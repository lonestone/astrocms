import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { fetchTree, type CollectionInfo } from '../../../api.js'
import { getCollectionFolderPaths } from '../../common/utils/collections.js'
import { useCollections } from './useCollections.js'
import { useSorts, DEFAULT_SORT } from './useFolderSort.js'

function collectionGlobs(info: CollectionInfo): string[] {
  if (info.loader === 'file') return []
  if (info.pattern === undefined) return []
  const patterns = Array.isArray(info.pattern) ? info.pattern : [info.pattern]
  return patterns.map((p) => (info.base ? `${info.base}/${p}` : p))
}

/** Globs of the collection rooted exactly at `folderPath`, if any. */
function globsForCollectionFolder(
  folderPath: string,
  collections: Record<string, CollectionInfo>
): string[] {
  for (const [name, info] of Object.entries(collections)) {
    if (info.loader === 'file') continue
    const folder = info.base ?? name
    if (folder === folderPath) return collectionGlobs(info)
  }
  return []
}

export function useTree() {
  const queryClient = useQueryClient()
  const sorts = useSorts()
  const { data: collectionsData } = useCollections()
  const collections = collectionsData?.collections ?? {}

  // Only collection folders may define a sort; others are ignored.
  const includeParams = useMemo(() => {
    const collectionFolders = getCollectionFolderPaths(collections)
    const byPattern = new Map<string, Set<string>>()
    for (const [folder, s] of Object.entries(sorts)) {
      if (s.field === DEFAULT_SORT.field) continue
      if (!collectionFolders.has(folder)) continue
      for (const g of globsForCollectionFolder(folder, collections)) {
        if (!byPattern.has(g)) byPattern.set(g, new Set())
        byPattern.get(g)!.add(s.field)
      }
    }
    return [...byPattern.entries()]
      .map(([pattern, fields]) => ({
        pattern,
        fields: [...fields].sort(),
      }))
      .sort((a, b) => a.pattern.localeCompare(b.pattern))
  }, [sorts, collections])

  const queryKey = useMemo(
    () => [
      'tree',
      includeParams
        .map((p) => `${p.pattern}:${p.fields.join(',')}`)
        .join('|'),
    ],
    [includeParams]
  )

  const { data: tree = [] } = useQuery({
    queryKey,
    queryFn: () => fetchTree(includeParams),
  })

  const invalidateTree = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tree'] })
  }, [queryClient])

  return { tree, invalidateTree }
}
