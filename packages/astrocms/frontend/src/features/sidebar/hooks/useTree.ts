import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { fetchTree, type CollectionInfo } from '../../../api.js'
import { useCollections } from './useCollections.js'
import { useNames } from './useFolderName.js'
import { useSorts } from './useFolderSort.js'
import {
  FILENAME_FIELD,
  getDefaultNameField,
  getDefaultSort,
} from '../utils/collectionDefaults.js'

function collectionGlobs(info: CollectionInfo): string[] {
  if (info.loader === 'file') return []
  if (info.pattern === undefined) return []
  const patterns = Array.isArray(info.pattern) ? info.pattern : [info.pattern]
  return patterns.map((p) => (info.base ? `${info.base}/${p}` : p))
}

export function useTree() {
  const queryClient = useQueryClient()
  const savedSorts = useSorts()
  const savedNames = useNames()
  const { data: collectionsData } = useCollections()
  const collections = collectionsData?.collections ?? {}

  // For every collection, gather the effective sort field + name field
  // (saved override or schema-derived smart default) and ask the server to
  // attach them under `data` on matching files.
  const includeParams = useMemo(() => {
    const byPattern = new Map<string, Set<string>>()
    for (const [name, info] of Object.entries(collections)) {
      if (info.loader === 'file') continue
      const folder = info.base ?? name
      const schema = info.schema ?? undefined
      const sort = savedSorts[folder] ?? getDefaultSort(schema)
      const nameField = savedNames[folder] ?? getDefaultNameField(schema)
      const fields: string[] = []
      if (sort.field !== FILENAME_FIELD) fields.push(sort.field)
      if (nameField !== FILENAME_FIELD) fields.push(nameField)
      if (fields.length === 0) continue
      for (const g of collectionGlobs(info)) {
        if (!byPattern.has(g)) byPattern.set(g, new Set())
        const set = byPattern.get(g)!
        for (const f of fields) set.add(f)
      }
    }
    return [...byPattern.entries()]
      .map(([pattern, fields]) => ({
        pattern,
        fields: [...fields].sort(),
      }))
      .sort((a, b) => a.pattern.localeCompare(b.pattern))
  }, [savedSorts, savedNames, collections])

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
