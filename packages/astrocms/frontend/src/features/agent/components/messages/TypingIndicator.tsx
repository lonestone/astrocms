import React from 'react'

export function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1 px-2 py-2"
      role="status"
      aria-label="Claude is typing"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-text-faint animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-text-faint animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-text-faint animate-bounce [animation-delay:300ms]" />
    </div>
  )
}
