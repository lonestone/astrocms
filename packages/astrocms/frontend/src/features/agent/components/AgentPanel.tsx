import React from 'react'
import { useResizablePanel } from '../../common/hooks/useResizablePanel.js'
import { ResizeHandle } from '../../common/components/ResizeHandle.js'
import { AgentThread } from './AgentThread.js'
import { AgentAuthError } from './AgentAuthError.js'
import { useAgentRuntime } from '../contexts/AgentRuntimeContext.js'
import { RiAddLine } from 'react-icons/ri'

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
        className={`bg-bg-panel flex flex-col shrink-0 overflow-hidden ${
          open ? '' : 'hidden'
        }`}
        aria-hidden={!open}
      >
        <div className="px-3 py-2.5 border-b border-border font-semibold text-xs flex items-center justify-between">
          <span>Agent</span>
          {isAuthenticated && (
            <button
              onClick={startNewConversation}
              className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text cursor-pointer"
              aria-label="New conversation"
              tabIndex={0}
            >
              <RiAddLine size={14} />
            </button>
          )}
        </div>

        {statusLoading ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
            Connecting to Claude...
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
