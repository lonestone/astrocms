import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { startClaudeLogin, submitClaudeLoginCode } from '../../../api.js'
import { TbLoader2, TbLogin2, TbRefresh, TbSparkles } from 'react-icons/tb'
import Button from '../../common/components/Button.js'
import { Input } from '../../common/components/Input.js'

interface Props {
  error?: string
  onRetry: () => void
}

type Status = 'idle' | 'starting' | 'awaiting_code' | 'submitting' | 'error'

export function AgentAuthError({ error, onRetry }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const queryClient = useQueryClient()

  async function handleStart() {
    setStatus('starting')
    setLoginError(null)
    setPasted('')

    try {
      const result = await startClaudeLogin()
      if (result.error) {
        setLoginError(result.error)
        setStatus('error')
        return
      }

      // Manual flow: open the URL where Claude will show the code+state
      const url = result.manualUrl || result.automaticUrl
      if (url) window.open(url, '_blank')

      setStatus('awaiting_code')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
      setStatus('error')
    }
  }

  async function handleSubmit() {
    const trimmed = pasted.trim()
    if (!trimmed) return

    // Claude returns the code as `code#state`
    const hashIdx = trimmed.indexOf('#')
    if (hashIdx === -1) {
      setLoginError('Invalid code format. Expected `code#state`.')
      setStatus('error')
      return
    }

    const code = trimmed.slice(0, hashIdx)
    const state = trimmed.slice(hashIdx + 1)

    setStatus('submitting')
    setLoginError(null)

    try {
      const result = await submitClaudeLoginCode(code, state)
      if (result.error) {
        setLoginError(result.error)
        setStatus('error')
        return
      }
      setStatus('idle')
      setPasted('')
      queryClient.invalidateQueries({ queryKey: ['claude-status'] })
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
      setStatus('error')
    }
  }

  const isLoading = status === 'starting' || status === 'submitting'
  const shownError =
    status !== 'awaiting_code' ? loginError || error : null

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-panel border border-border bg-surface-raised text-text-muted">
        <TbSparkles size={20} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-text">Claude is not connected</p>
        <p className="text-ui text-text-muted">
          {status === 'awaiting_code'
            ? 'Authorize in the new tab, then paste the code Claude shows you.'
            : 'Sign in once to let the agent edit your content.'}
        </p>
      </div>

      {shownError && (
        <p className="max-h-24 w-full overflow-y-auto break-words rounded-md border border-danger/30 bg-danger-soft px-2.5 py-2 text-left text-2xs text-danger-text">
          {shownError}
        </p>
      )}

      {status === 'awaiting_code' || status === 'submitting' ? (
        <div className="flex w-full flex-col gap-2">
          <Input
            type="text"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste the code here"
            disabled={status === 'submitting'}
            className="font-mono text-xs"
            autoFocus
          />
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={!pasted.trim() || status === 'submitting'}
            icon={
              status === 'submitting' ? (
                <TbLoader2 size={16} className="animate-spin" />
              ) : undefined
            }
          >
            {status === 'submitting' ? 'Submitting' : 'Submit code'}
          </Button>
        </div>
      ) : (
        <Button
          variant="primary"
          size="lg"
          onClick={handleStart}
          disabled={isLoading}
          className="w-full"
          icon={
            isLoading ? (
              <TbLoader2 size={16} className="animate-spin" />
            ) : (
              <TbLogin2 size={16} />
            )
          }
        >
          {isLoading ? 'Starting login' : 'Sign in with Claude'}
        </Button>
      )}

      {!isLoading && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          icon={<TbRefresh size={14} />}
        >
          Retry connection
        </Button>
      )}
    </div>
  )
}
