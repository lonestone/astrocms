import { useEffect, useRef } from 'react'
import { useAuiState } from '@assistant-ui/react'
import { useFiles } from '../../file/contexts/FilesContext.js'

/**
 * Watches the assistant-ui thread and invalidates every file-related query
 * once a run finishes, so the editor and sidebar reflect whatever the agent
 * changed on disk.
 */
export function useInvalidateFilesOnIdle() {
  const isRunning = useAuiState((s) => s.thread.isRunning)
  const { invalidateFiles } = useFiles()
  const wasRunning = useRef(false)

  useEffect(() => {
    if (wasRunning.current && !isRunning) {
      invalidateFiles()
    }
    wasRunning.current = isRunning
  }, [isRunning, invalidateFiles])
}
