import React, { useCallback, useEffect, useRef, useState } from 'react'
import { RiSendPlane2Fill, RiSparkling2Line } from 'react-icons/ri'
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
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 cursor-default"
        />
      )}
      <div
        className={
          focused
            ? 'pointer-events-auto fixed inset-x-0 mx-auto top-16 w-[min(720px,calc(100%-2rem))] z-40 shadow-2xl animate-header-prompt-in'
            : 'pointer-events-auto relative w-full max-w-md'
        }
      >
        <div
          className={`rounded-xl border bg-white transition-colors ${
            focused
              ? 'border-primary ring-4 ring-primary/15'
              : 'border-border hover:border-gray-400'
          }`}
        >
          <label
            className={`flex items-start gap-2 cursor-text ${
              focused ? 'px-4 py-3' : 'px-3 py-1.5'
            }`}
          >
            <div className="shrink-0 h-5 flex items-center text-primary">
              <RiSparkling2Line size={focused ? 16 : 14} />
            </div>
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
              placeholder={focused ? 'Ask AI to help with anything...' : 'Ask AI...'}
              rows={focused ? 3 : 1}
              className={`flex-1 resize-none outline-none bg-transparent text-sm leading-5 placeholder:text-text-muted ${
                focused ? '' : 'h-5 overflow-hidden'
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
                tabIndex={0}
                className="shrink-0 p-2 rounded-lg bg-primary text-white enabled:hover:bg-primary-hover disabled:opacity-40 disabled:cursor-default cursor-pointer"
              >
                <RiSendPlane2Fill size={14} />
              </button>
            )}
          </label>
          {focused && (
            <div className="px-4 pb-2 text-[10px] text-text-muted text-center">
              Enter to send, Shift+Enter for new line, Esc to close
            </div>
          )}
        </div>
      </div>
    </>
  )
}
