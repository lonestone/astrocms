import React from 'react'
import { Link } from 'react-router'
import {
  TbExternalLink,
  TbGitCommit,
  TbMessageChatbot,
  TbRocket,
} from 'react-icons/tb'
import Button from './Button.js'
import { HeaderAgentPrompt } from './HeaderAgentPrompt.js'
import { HeaderMenu } from './HeaderMenu.js'
import { ThemeToggle } from './ThemeToggle.js'
import { useGitStatus } from '../../git/hooks/useGit.js'
import { usePublicConfig } from '../hooks/usePublicConfig.js'

interface Props {
  agentOpen: boolean
  onToggleAgent: () => void
  onNavigateGit: () => void
}

export function Header({ agentOpen, onToggleAgent, onNavigateGit }: Props) {
  const config = usePublicConfig()
  const { data: files = [] } = useGitStatus()
  const changeCount = files.length

  return (
    <header className="relative z-20 flex h-13 shrink-0 items-center gap-4 border-b border-border bg-surface-raised px-3">
      <Link
        to="/"
        className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 text-text no-underline transition-colors hover:bg-surface-hover"
        aria-label="AstroCMS home"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-fg">
          <TbRocket size={16} />
        </span>
        <span className="text-sm font-semibold tracking-tight">AstroCMS</span>
      </Link>

      <div className="flex flex-1 justify-center">
        <HeaderAgentPrompt />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {changeCount > 0 && (
          <Button
            variant="success"
            onClick={onNavigateGit}
            icon={<TbGitCommit size={16} />}
          >
            Review changes
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-2xs font-semibold tabular-nums">
              {changeCount}
            </span>
          </Button>
        )}
        {config?.devServer && (
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-ui font-medium text-text-secondary no-underline transition-colors hover:bg-surface-hover hover:text-text"
          >
            Preview
            <TbExternalLink size={16} />
          </a>
        )}
        <Button
          active={agentOpen}
          variant="ghost"
          onClick={onToggleAgent}
          icon={<TbMessageChatbot size={16} />}
          aria-pressed={agentOpen}
        >
          Agent
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <ThemeToggle />
        <HeaderMenu />
      </div>
    </header>
  )
}
