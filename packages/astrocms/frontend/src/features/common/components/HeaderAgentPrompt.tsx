import React, { useCallback, useEffect, useRef, useState } from 'react'
import { TbArrowUp, TbSparkles } from 'react-icons/tb'
import { useAgentRuntime } from '../../agent/contexts/AgentRuntimeContext.js'

export function HeaderAgentPrompt() {
  const { isAuthenticated, sendInNewConversation } = useAgentRuntime()
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!focused) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused])

  const handleSubmit = useCallback(() => {
    const text = value.trim()
    if (!text) return
    void sendInNewConversation(text)
    setValue('')
    inputRef.current?.blur()
  }, [value, sendInNewConversation])

  if (!isAuthenticated) return null

  return (
    <>
      {focused && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close prompt"
          onClick={() => inputRef.current?.blur()}
          className="fixed inset-0 z-30 cursor-default bg-overlay animate-fade-in"
        />
      )}
      <div
        className={
          focused
            ? 'pointer-events-auto fixed inset-x-0 top-16 z-40 mx-auto w-[min(680px,calc(100%-2rem))] animate-pop-in'
            : 'pointer-events-auto relative w-full max-w-md'
        }
      >
        <div
          className={`rounded-panel border bg-surface-raised transition-colors duration-150 ${
            focused
              ? 'border-accent shadow-dialog ring-2 ring-ring'
              : 'border-border hover:border-border-strong'
          }`}
        >
          <label
            className={`flex cursor-text items-start gap-2 ${
              focused ? 'px-4 py-3' : 'px-3 py-1.5'
            }`}
          >
            <span
              className={`flex h-6 shrink-0 items-center ${
                focused ? 'text-accent-text' : 'text-text-muted'
              }`}
            >
              <TbSparkles size={16} />
            </span>
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder={
                focused
                  ? 'Describe what you want to change or create'
                  : 'Ask the agent'
              }
              rows={focused ? 3 : 1}
              className={`flex-1 resize-none bg-transparent text-base leading-6 text-text outline-none placeholder:text-text-faint ${
                focused ? '' : 'h-6 overflow-hidden'
              }`}
            />
            {focused && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSubmit()
                }}
                disabled={!value.trim()}
                aria-label="Send to agent"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg transition-colors enabled:hover:bg-accent-hover enabled:cursor-pointer disabled:opacity-40"
              >
                <TbArrowUp size={16} />
              </button>
            )}
          </label>
          {focused && (
            <div className="flex items-center gap-3 border-t border-border px-4 py-1.5 text-xs text-text-muted">
              <span>
                <kbd className="font-sans">Enter</kbd> to send
              </span>
              <span>
                <kbd className="font-sans">Shift + Enter</kbd> for a new line
              </span>
              <span className="ml-auto">
                <kbd className="font-sans">Esc</kbd> to close
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
