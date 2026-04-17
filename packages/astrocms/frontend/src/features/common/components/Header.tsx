import React from 'react'
import { FiExternalLink } from 'react-icons/fi'
import { useQuery } from '@tanstack/react-query'
import Button from './Button.js'
import { fetchPublicConfig } from '../../../api.js'

interface Props {
  gitOpen: boolean
  onToggleGit: () => void
  agentOpen: boolean
  onToggleAgent: () => void
}

export function Header({
  gitOpen,
  onToggleGit,
  agentOpen,
  onToggleAgent,
}: Props) {
  const { data: config } = useQuery({
    queryKey: ['public-config'],
    queryFn: fetchPublicConfig,
    staleTime: Infinity,
  })

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-4 bg-white shrink-0">
      <span className="font-semibold text-sm">AstroCMS</span>
      <div className="flex gap-2">
        {config?.websiteUrl && (
          <a
            href={config.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 rounded-md border border-border bg-white text-text no-underline text-xs cursor-pointer hover:bg-gray-100 inline-flex items-center"
          >
            Preview <FiExternalLink className="ml-1 align-middle" />
          </a>
        )}
        <Button active={gitOpen} onClick={onToggleGit}>
          Git
        </Button>
        <Button active={agentOpen} onClick={onToggleAgent}>
          Agent
        </Button>
      </div>
    </header>
  )
}
