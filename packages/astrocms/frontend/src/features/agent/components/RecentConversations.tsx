import React, { useState } from 'react'
import { TbHistory } from 'react-icons/tb'
import type { Conversation } from '../../../api.js'
import { stripRolePrefix } from './messages/utils.js'

interface Props {
  conversations: Conversation[]
  onSelect: (id: string) => void
}

export function RecentConversations({ conversations, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false)

  const visible = expanded ? conversations : conversations.slice(0, 3)

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <p className="text-ui font-medium text-text">Start a conversation</p>
        <p className="text-xs text-text-muted">
          Ask for a new page, a rewrite, a translation, or a review of your
          pending changes.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="mb-1 flex items-center gap-1.5 px-2 text-xs font-medium text-text-muted">
        <TbHistory size={14} />
        Recent conversations
      </div>
      {visible.map((conv) => {
        const label = stripRolePrefix(conv.customTitle || conv.summary)
        return (
          <button
            key={conv.id}
            type="button"
            onClick={() => onSelect(conv.id)}
            className="w-full rounded-md px-2 py-1.5 text-left cursor-pointer transition-colors duration-100 hover:bg-surface-hover"
            aria-label={`Resume: ${label.slice(0, 50)}`}
          >
            <div className="line-clamp-2 text-ui leading-relaxed text-text">
              {label}
            </div>
          </button>
        )
      })}
      {!expanded && conversations.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start rounded-md px-2 py-1 text-xs text-accent-text cursor-pointer hover:underline"
          aria-label="Show more conversations"
        >
          Show all ({conversations.length})
        </button>
      )}
    </div>
  )
}
