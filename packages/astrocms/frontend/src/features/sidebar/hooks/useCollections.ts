import { useQuery } from '@tanstack/react-query'
import { fetchCollections } from '../../../api.js'

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: fetchCollections,
    staleTime: 5 * 60 * 1000,
  })
}
