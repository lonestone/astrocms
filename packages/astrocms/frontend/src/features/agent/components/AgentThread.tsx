import React, { useEffect, useCallback } from 'react'
import {
  ThreadPrimitive,
  ComposerPrimitive,
  useAuiState,
  useAui,
} from '@assistant-ui/react'
import { TbArrowUp, TbPlayerStopFilled } from 'react-icons/tb'
import { UserMessage } from './UserMessage.js'
import { AssistantMessage } from './AssistantMessage.js'
import { RecentConversations } from './RecentConversations.js'
import { LoadedMessages } from './LoadedMessages.js'
import { PermissionRequest } from './PermissionRequest.js'
import { AskUserQuestionRequest } from './AskUserQuestionRequest.js'
import { useAutoScroll } from '../hooks/useAutoScroll.js'
import { usePendingPermission } from '../hooks/usePendingPermission.js'
import { useInvalidateFilesOnIdle } from '../hooks/useInvalidateFilesOnIdle.js'
import type { Conversation } from '../../../api.js'

interface Props {
  loadedMessages: any[] | null
  conversations: Conversation[]
  onSelectConversation: (id: string) => void
}

export function AgentThread({
  loadedMessages,
  conversations,
  onSelectConversation,
}: Props) {
  const {
    ref: scrollRef,
    onScroll,
    scrollToBottom,
  } = useAutoScroll<HTMLDivElement>()
  const isRunning = useAuiState((s) => s.thread.isRunning)
  const { permission, clear: clearPermission } = usePendingPermission(isRunning)
  useInvalidateFilesOnIdle()

  useEffect(() => {
    scrollToBottom()
  }, [loadedMessages, scrollToBottom])

  useEffect(() => {
    if (permission) scrollToBottom()
  }, [permission, scrollToBottom])

  const hasHistory = loadedMessages && loadedMessages.length > 0

  return (
    <ThreadPrimitive.Root className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-3 py-3"
      >
        {hasHistory ? (
          <LoadedMessages messages={loadedMessages} />
        ) : (
          <ThreadPrimitive.Empty>
            <RecentConversations
              conversations={conversations}
              onSelect={onSelectConversation}
            />
          </ThreadPrimitive.Empty>
        )}
        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            AssistantMessage,
          }}
        />
        {permission &&
          (permission.toolName === 'AskUserQuestion' ? (
            <AskUserQuestionRequest
              permission={permission}
              onResolved={clearPermission}
            />
          ) : (
            <PermissionRequest
              permission={permission}
              onResolved={clearPermission}
            />
          ))}
        <div className="h-2" />
      </div>
      <AgentComposer />
    </ThreadPrimitive.Root>
  )
}

function AgentComposer() {
  const isRunning = useAuiState((s) => s.thread.isRunning)
  const aui = useAui()
  const handleStop = useCallback(() => {
    aui.thread().cancelRun()
  }, [aui])

  return (
    <div className="shrink-0 border-t border-border bg-surface p-3">
      <ComposerPrimitive.Root className="flex flex-col rounded-panel border border-border bg-surface-raised transition-colors duration-150 focus-within:border-accent focus-within:ring-2 focus-within:ring-ring">
        <ComposerPrimitive.Input
          placeholder="Ask Claude to edit, create or review content"
          className="max-h-40 min-h-16 w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-base leading-6 text-text outline-none placeholder:text-text-faint"
          rows={3}
          autoFocus
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="pl-1 text-xs text-text-faint">
            Enter to send, Shift + Enter for a new line
          </span>
          {isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-danger-soft px-3 text-xs font-medium text-danger-text cursor-pointer transition-colors hover:bg-danger hover:text-white"
              aria-label="Stop generation"
            >
              <TbPlayerStopFilled size={14} />
              Stop
            </button>
          ) : (
            <ComposerPrimitive.Send
              className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg transition-colors enabled:hover:bg-accent-hover enabled:cursor-pointer disabled:opacity-40"
              aria-label="Send"
            >
              <TbArrowUp size={16} />
            </ComposerPrimitive.Send>
          )}
        </div>
      </ComposerPrimitive.Root>
    </div>
  )
}
