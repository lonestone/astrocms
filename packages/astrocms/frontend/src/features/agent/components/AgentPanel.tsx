import React, { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useResizablePanel } from '../../common/hooks/useResizablePanel.js'
import { ResizeHandle } from '../../common/components/ResizeHandle.js'
import { ChatView } from './ChatView.js'
import { AgentAuthError } from './AgentAuthError.js'
import {
  fetchConversations,
  fetchConversationMessages,
  fetchClaudeStatus,
} from '../../../api.js'
import { RiAddLine } from 'react-icons/ri'

const SESSION_STORAGE_KEY = 'cms-agent-session-id'

function readStoredSessionId(): string | null {
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredSessionId(value: string | null) {
  try {
    if (value === null) localStorage.removeItem(SESSION_STORAGE_KEY)
    else localStorage.setItem(SESSION_STORAGE_KEY, value)
  } catch {}
}

interface Props {
  open: boolean
}

export function AgentPanel({ open }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    readStoredSessionId()
  )
  const [loadedMessages, setLoadedMessages] = useState<any[] | null>(null)

  const {
    data: status,
    isLoading: statusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['claude-status'],
    queryFn: () => fetchClaudeStatus(),
    retry: false,
    staleTime: 60_000,
  })

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => fetchConversations(20),
    enabled: status?.authenticated === true,
  })

  const { width, handleMouseDown } = useResizablePanel({
    storageKey: 'cms-agent-panel-width',
    defaultWidth: 380,
    minWidth: 250,
    maxWidth: 800,
    side: 'left',
  })

  // Hydrate messages for a session that was restored from localStorage.
  const isAuthenticated = status?.authenticated === true
  useEffect(() => {
    if (!sessionId || !isAuthenticated || loadedMessages !== null) return
    let cancelled = false
    fetchConversationMessages(sessionId).then((messages) => {
      if (!cancelled) setLoadedMessages(messages)
    })
    return () => {
      cancelled = true
    }
  }, [sessionId, isAuthenticated, loadedMessages])

  const handleNewConversation = useCallback(() => {
    setSessionId(null)
    setLoadedMessages(null)
    writeStoredSessionId(null)
  }, [])

  const handleSelectConversation = useCallback(async (id: string) => {
    setSessionId(id)
    writeStoredSessionId(id)
    const messages = await fetchConversationMessages(id)
    setLoadedMessages(messages)
  }, [])

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
              onClick={handleNewConversation}
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
          <ChatView
            key={sessionId}
            sessionId={sessionId}
            loadedMessages={loadedMessages}
            conversations={conversations}
            onSelectConversation={handleSelectConversation}
          />
        )}
      </aside>
    </>
  )
}
