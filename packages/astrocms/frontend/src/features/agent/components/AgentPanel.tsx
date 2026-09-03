import React from 'react'
import { TbPlus, TbSparkles } from 'react-icons/tb'
import { useResizablePanel } from '../../common/hooks/useResizablePanel.js'
import { ResizeHandle } from '../../common/components/ResizeHandle.js'
import { IconButton } from '../../common/components/IconButton.js'
import { AgentThread } from './AgentThread.js'
import { AgentAuthError } from './AgentAuthError.js'
import { useAgentRuntime } from '../contexts/AgentRuntimeContext.js'

interface Props {
  open: boolean
}

export function AgentPanel({ open }: Props) {
  const {
    status,
    statusLoading,
    isAuthenticated,
    refetchStatus,
    sessionId,
    loadedMessages,
    conversations,
    startNewConversation,
    selectConversation,
  } = useAgentRuntime()

  const { width, handleMouseDown } = useResizablePanel({
    storageKey: 'cms-agent-panel-width',
    defaultWidth: 380,
    minWidth: 250,
    maxWidth: 800,
    side: 'left',
  })

  return (
    <>
      {open && <ResizeHandle side="left" onMouseDown={handleMouseDown} />}
      <aside
        style={{ width: open ? width : 0 }}
        className={`flex shrink-0 flex-col overflow-hidden bg-surface ${
          open ? '' : 'hidden'
        }`}
        aria-hidden={!open}
        aria-label="Agent"
      >
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="flex items-center gap-1.5 text-ui font-semibold text-text">
            <TbSparkles size={16} className="text-accent-text" />
            Agent
          </span>
          {isAuthenticated && (
            <IconButton label="New conversation" onClick={startNewConversation}>
              <TbPlus size={16} />
            </IconButton>
          )}
        </div>

        {statusLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-ui text-text-muted">
            <span className="skeleton h-2 w-28" />
            Connecting to Claude
          </div>
        ) : !isAuthenticated ? (
          <AgentAuthError
            error={status?.error}
            onRetry={() => refetchStatus()}
          />
        ) : (
          <AgentThread
            key={sessionId}
            loadedMessages={loadedMessages}
            conversations={conversations}
            onSelectConversation={selectConversation}
          />
        )}
      </aside>
    </>
  )
}
