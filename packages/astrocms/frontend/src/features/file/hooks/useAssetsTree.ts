import { useQuery } from '@tanstack/react-query'
import { fetchTree, type TreeNode } from '../../../api.js'

/** Tree of the configured assets directory. Empty while disabled or loading. */
export function useAssetsTree(enabled: boolean): TreeNode[] {
  const { data = [] } = useQuery({
    queryKey: ['tree', 'assets'],
    queryFn: () => fetchTree([], 'assets'),
    enabled,
  })
  return data
}
