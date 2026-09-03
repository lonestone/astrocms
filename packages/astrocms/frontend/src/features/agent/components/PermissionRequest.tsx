import React, { useState } from 'react'
import { TbShieldQuestion } from 'react-icons/tb'
import type { PendingPermission } from '../../../api.js'
import { respondToPermission } from '../../../api.js'
import Button from '../../common/components/Button.js'

interface Props {
  permission: PendingPermission
  onResolved: () => void
}

function formatInput(toolName: string, input: Record<string, unknown>): string | null {
  if (!input || Object.keys(input).length === 0) return null

  // Show the most relevant field for known tools
  if (toolName === 'WebSearch' && input.query) return String(input.query)
  if (toolName === 'WebFetch' && input.url) return String(input.url)
  if (toolName === 'Bash' && input.command) return String(input.command)
  if ((toolName === 'Read' || toolName === 'Write' || toolName === 'Edit') && input.file_path)
    return String(input.file_path)

  // Generic: show all key=value pairs
  return Object.entries(input)
    .map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v)
      return `${k}: ${val}`
    })
    .join('\n')
}

export function PermissionRequest({ permission, onResolved }: Props) {
  const [responding, setResponding] = useState(false)

  async function handleRespond(behavior: 'allow' | 'deny') {
    setResponding(true)
    await respondToPermission(permission.id, behavior, {})
    onResolved()
  }

  const summary = permission.title || `Use ${permission.toolName}`
  const inputDetails = formatInput(permission.toolName, permission.input)

  return (
    <div className="mb-3 overflow-hidden rounded-panel border border-warning/40 bg-surface-raised animate-pop-in">
      <div className="flex items-start gap-2 bg-warning-soft px-3 py-2">
        <TbShieldQuestion size={16} className="mt-0.5 shrink-0 text-warning-text" />
        <div className="min-w-0 flex-1">
          <div className="text-ui font-semibold text-warning-text">
            {summary}
          </div>
          {permission.decisionReason && (
            <div className="mt-0.5 text-xs text-text-secondary">
              {permission.decisionReason}
            </div>
          )}
        </div>
      </div>
      {inputDetails && (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words border-t border-border bg-surface-inset px-3 py-2 font-mono text-xs text-text-secondary">
          {inputDetails}
        </pre>
      )}
      <div className="flex gap-2 border-t border-border bg-surface px-3 py-2">
        <Button
          variant="primary"
          onClick={() => handleRespond('allow')}
          disabled={responding}
        >
          Allow
        </Button>
        <Button
          variant="ghost"
          onClick={() => handleRespond('deny')}
          disabled={responding}
        >
          Deny
        </Button>
      </div>
    </div>
  )
}
