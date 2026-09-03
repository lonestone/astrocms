import React, { useState } from 'react'
import {
  TbFileSearch,
  TbFileText,
  TbGlobe,
  TbPencil,
  TbRobot,
  TbSearch,
  TbTerminal2,
  TbTool,
  TbWorldSearch,
} from 'react-icons/tb'
import { Arrow } from './Arrow.js'
import { DiffView } from './DiffView.js'
import { relativePath, formatResult } from './utils.js'

interface Props {
  name: string
  input: any
  result?: any
  isError?: boolean
}

function toolIcon(name: string) {
  const size = 13
  switch (name) {
    case 'Read':
      return <TbFileText size={size} />
    case 'Edit':
    case 'Write':
      return <TbPencil size={size} />
    case 'Glob':
      return <TbFileSearch size={size} />
    case 'Grep':
      return <TbSearch size={size} />
    case 'Bash':
      return <TbTerminal2 size={size} />
    case 'Agent':
      return <TbRobot size={size} />
    case 'WebFetch':
      return <TbGlobe size={size} />
    case 'WebSearch':
      return <TbWorldSearch size={size} />
    default:
      return <TbTool size={size} />
  }
}

export function ToolCallBlock({ name, input, result, isError }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const body = renderToolBody(name, input)
  const resultText = formatResult(result)

  return (
    <div
      className={`mb-2 overflow-hidden rounded-md border bg-surface-raised ${
        isError ? 'border-danger/40' : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span
          className={`shrink-0 ${
            isError ? 'text-danger-text' : 'text-text-muted'
          }`}
        >
          {toolIcon(name)}
        </span>
        <span className="text-xs font-semibold text-text">{name}</span>
        {body.summary && (
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">
            {body.summary}
          </span>
        )}
      </div>

      {/* Readable content */}
      {body.content && (
        <div className="max-h-60 overflow-auto whitespace-pre-wrap break-words border-t border-border bg-surface-inset px-3 py-2 font-mono text-xs text-text-secondary">
          {body.content}
        </div>
      )}

      {/* Raw JSON details (collapsible) */}
      {body.hasRawDetails && (
        <>
          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex w-full items-center gap-1 border-t border-border px-2.5 py-1 text-xs text-text-muted cursor-pointer transition-colors hover:bg-surface-hover hover:text-text"
            aria-expanded={detailsOpen}
          >
            <Arrow open={detailsOpen} />
            Details
          </button>
          {detailsOpen && (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-border bg-surface-inset px-3 py-2 font-mono text-xs text-text-secondary">
              {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
            </pre>
          )}
        </>
      )}

      {/* Result (collapsible) */}
      {resultText && (
        <>
          <button
            type="button"
            onClick={() => setResultOpen(!resultOpen)}
            className={`flex w-full items-center gap-1 border-t border-border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
              isError
                ? 'text-danger-text hover:bg-danger-soft'
                : 'text-text-muted hover:bg-surface-hover hover:text-text'
            }`}
            aria-expanded={resultOpen}
          >
            <Arrow open={resultOpen} />
            {isError ? 'Error' : 'Result'}
          </button>
          {resultOpen && (
            <div
              className={`max-h-48 overflow-auto whitespace-pre-wrap break-words border-t border-border px-3 py-2 font-mono text-xs ${
                isError
                  ? 'bg-danger-soft text-danger-text'
                  : 'bg-surface-inset text-text-secondary'
              }`}
            >
              {resultText}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// --- Tool body rendering ---

interface ToolBody {
  summary: string
  content: React.ReactNode | null
  hasRawDetails: boolean
}

function renderToolBody(name: string, input: any): ToolBody {
  if (!input || typeof input !== 'object') {
    return { summary: '', content: null, hasRawDetails: false }
  }

  const path = relativePath(input.file_path)

  if (name === 'Read') {
    return { summary: path, content: null, hasRawDetails: false }
  }

  if (name === 'Edit' && input.old_string != null) {
    return {
      summary: path,
      content: <DiffView oldStr={input.old_string} newStr={input.new_string} />,
      hasRawDetails: false,
    }
  }

  if (name === 'Write' && input.content != null) {
    return {
      summary: path,
      content: <AdditionView text={input.content} />,
      hasRawDetails: false,
    }
  }

  if (name === 'Glob') {
    return { summary: input.pattern || '', content: null, hasRawDetails: false }
  }

  if (name === 'Grep') {
    return { summary: input.pattern || '', content: null, hasRawDetails: false }
  }

  if (name === 'Bash') {
    return {
      summary: input.description || '',
      content: input.command || null,
      hasRawDetails: false,
    }
  }

  if (name === 'Agent') {
    return {
      summary: input.description || '',
      content: input.prompt || null,
      hasRawDetails: false,
    }
  }

  if (name === 'WebFetch') {
    return {
      summary: input.url || '',
      content: input.prompt || null,
      hasRawDetails: false,
    }
  }

  if (name === 'WebSearch') {
    return { summary: input.query || '', content: null, hasRawDetails: false }
  }

  return { summary: '', content: null, hasRawDetails: true }
}

function AdditionView({ text }: { text: string }) {
  const lines = text.replace(/\n$/, '').split('\n')
  return (
    <div className="font-mono text-xs leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className="-mx-3 bg-diff-add px-3 text-diff-add-text">
          <span className="inline-block w-3 select-none text-center opacity-60">+</span>
          {line}
        </div>
      ))}
    </div>
  )
}
