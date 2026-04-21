import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { AssistantRuntimeProvider, useAui } from '@assistant-ui/react'
import {
  useChatRuntime,
  AssistantChatTransport,
} from '@assistant-ui/react-ai-sdk'
import {
  fetchConversations,
  fetchConversationMessages,
  fetchClaudeStatus,
  type ClaudeStatus,
  type Conversation,
} from '../../../api.js'

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

interface AgentRuntimeContextValue {
  status: ClaudeStatus | undefined
  statusLoading: boolean
  isAuthenticated: boolean
  refetchStatus: () => void
  sessionId: string | null
  loadedMessages: any[] | null
  conversations: Conversation[]
  startNewConversation: () => void
  selectConversation: (id: string) => Promise<void>
  sendPrompt: (prompt: string) => void
  requestOpen: () => void
}

const AgentRuntimeContext = createContext<AgentRuntimeContextValue | null>(null)

export function useAgentRuntime() {
  const ctx = useContext(AgentRuntimeContext)
  if (!ctx) {
    throw new Error('useAgentRuntime must be used inside AgentRuntimeProvider')
  }
  return ctx
}

interface Props {
  children: React.ReactNode
  onRequestOpen: () => void
}

export function AgentRuntimeProvider({ children, onRequestOpen }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(() =>
    readStoredSessionId()
  )
  const [loadedMessages, setLoadedMessages] = useState<any[] | null>(null)

  const {
    data: status,
    isLoading: statusLoading,
    refetch,
  } = useQuery({
    queryKey: ['claude-status'],
    queryFn: () => fetchClaudeStatus(),
    retry: false,
    staleTime: 60_000,
  })

  const isAuthenticated = status?.authenticated === true

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => fetchConversations(20),
    enabled: isAuthenticated,
  })

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

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: sessionId
          ? `/astrocms/api/claude/chat?sessionId=${encodeURIComponent(sessionId)}`
          : '/astrocms/api/claude/chat',
      }),
    [sessionId]
  )

  const runtime = useChatRuntime({ transport })

  const startNewConversation = useCallback(() => {
    setSessionId(null)
    setLoadedMessages(null)
    writeStoredSessionId(null)
  }, [])

  const selectConversation = useCallback(async (id: string) => {
    setSessionId(id)
    writeStoredSessionId(id)
    const messages = await fetchConversationMessages(id)
    setLoadedMessages(messages)
  }, [])

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AgentRuntimeBridge
        status={status}
        statusLoading={statusLoading}
        isAuthenticated={isAuthenticated}
        refetchStatus={refetch}
        sessionId={sessionId}
        loadedMessages={loadedMessages}
        conversations={conversations}
        startNewConversation={startNewConversation}
        selectConversation={selectConversation}
        onRequestOpen={onRequestOpen}
      >
        {children}
      </AgentRuntimeBridge>
    </AssistantRuntimeProvider>
  )
}

interface BridgeProps {
  children: React.ReactNode
  status: ClaudeStatus | undefined
  statusLoading: boolean
  isAuthenticated: boolean
  refetchStatus: () => void
  sessionId: string | null
  loadedMessages: any[] | null
  conversations: Conversation[]
  startNewConversation: () => void
  selectConversation: (id: string) => Promise<void>
  onRequestOpen: () => void
}

function AgentRuntimeBridge({
  children,
  status,
  statusLoading,
  isAuthenticated,
  refetchStatus,
  sessionId,
  loadedMessages,
  conversations,
  startNewConversation,
  selectConversation,
  onRequestOpen,
}: BridgeProps) {
  const aui = useAui()
  const requestOpenRef = useRef(onRequestOpen)
  requestOpenRef.current = onRequestOpen

  const sendPrompt = useCallback(
    (prompt: string) => {
      const text = prompt.trim()
      if (!text) return
      requestOpenRef.current()
      aui.thread().append(text)
    },
    [aui]
  )

  const requestOpen = useCallback(() => {
    requestOpenRef.current()
  }, [])

  const value = useMemo<AgentRuntimeContextValue>(
    () => ({
      status,
      statusLoading,
      isAuthenticated,
      refetchStatus,
      sessionId,
      loadedMessages,
      conversations,
      startNewConversation,
      selectConversation,
      sendPrompt,
      requestOpen,
    }),
    [
      status,
      statusLoading,
      isAuthenticated,
      refetchStatus,
      sessionId,
      loadedMessages,
      conversations,
      startNewConversation,
      selectConversation,
      sendPrompt,
      requestOpen,
    ]
  )

  return (
    <AgentRuntimeContext.Provider value={value}>
      {children}
    </AgentRuntimeContext.Provider>
  )
}
