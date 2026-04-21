import React from 'react'
import { FiExternalLink } from 'react-icons/fi'
import { useQuery } from '@tanstack/react-query'
import Button from './Button.js'
import { HeaderAgentPrompt } from './HeaderAgentPrompt.js'
import { HeaderMenu } from './HeaderMenu.js'
import { useGitStatus } from '../../git/hooks/useGit.js'
import { fetchPublicConfig } from '../../../api.js'

interface Props {
  agentOpen: boolean
  onToggleAgent: () => void
  onNavigateGit: () => void
}

export function Header({
  agentOpen,
  onToggleAgent,
  onNavigateGit,
}: Props) {
  const { data: config } = useQuery({
    queryKey: ['public-config'],
    queryFn: fetchPublicConfig,
    staleTime: Infinity,
  })
  const { data: files = [] } = useGitStatus()
  const changeCount = files.length

  return (
    <header className="h-12 border-b border-border flex items-center gap-4 px-4 bg-white shrink-0 relative z-20">
      <span className="font-semibold text-sm shrink-0">AstroCMS</span>
      <div className="flex-1 flex justify-center">
        <HeaderAgentPrompt />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {config?.devServer && (
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-md border border-border bg-white text-text no-underline text-xs cursor-pointer hover:bg-gray-100 inline-flex items-center"
          >
            Preview <FiExternalLink className="ml-1 align-middle" />
          </a>
        )}
        <HeaderMenu />
        <Button active={agentOpen} onClick={onToggleAgent}>
          Agent
        </Button>
        {changeCount > 0 && (
          <Button variant="success" onClick={onNavigateGit}>
            <span className="inline-flex items-center gap-1.5">
              Review changes
              <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-white/25 text-white text-[10px] font-semibold">
                {changeCount}
              </span>
            </span>
          </Button>
        )}
      </div>
    </header>
  )
}
