import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchFile, saveFile } from '../../../api.js'

export function useFile(filePath: string) {
  return useQuery({
    queryKey: ['file', filePath],
    queryFn: () => fetchFile(filePath),
    retry: false,
  })
}

export function useSaveFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      saveFile(path, content),
    onSuccess: (_data, { path, content }) => {
      // Keep the file cache in sync with what we just wrote so that navigating
      // away and back doesn't resurrect pre-save content. `tree` invalidation
      // stays the caller's responsibility (the editor decides based on whether
      // sort/display-name fields changed).
      queryClient.setQueryData(['file', path], { path, content })
      queryClient.invalidateQueries({ queryKey: ['gitStatus'] })
    },
  })
}
