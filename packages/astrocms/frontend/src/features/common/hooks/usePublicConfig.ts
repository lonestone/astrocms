import { useQuery } from '@tanstack/react-query'
import { fetchPublicConfig } from '../../../api.js'

export function usePublicConfig() {
  const { data } = useQuery({
    queryKey: ['public-config'],
    queryFn: fetchPublicConfig,
    staleTime: Infinity,
  })
  return data
}
