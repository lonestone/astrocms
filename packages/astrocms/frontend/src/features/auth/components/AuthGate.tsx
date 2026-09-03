import React, { useEffect, useState } from 'react'
import { TbRocket } from 'react-icons/tb'
import { fetchAuthStatus, login, onAuthRequired } from '../../../api.js'
import Button from '../../common/components/Button.js'
import { Field, Input } from '../../common/components/Input.js'

type Status = 'loading' | 'gated' | 'ok'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchAuthStatus()
      .then((s) => {
        if (cancelled) return
        setStatus(!s.required || s.authenticated ? 'ok' : 'gated')
      })
      .catch(() => {
        if (!cancelled) setStatus('gated')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return onAuthRequired(() => setStatus('gated'))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    setSubmitting(true)
    setError(null)
    const res = await login(password)
    setSubmitting(false)
    if (res.ok) {
      setPassword('')
      setStatus('ok')
    } else {
      setError(res.error ?? 'Invalid password')
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className="skeleton h-2 w-24" />
        </div>
      </div>
    )
  }

  if (status === 'gated') {
    return (
      <div className="flex h-screen items-center justify-center bg-bg p-4">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-xs flex-col gap-5 rounded-panel border border-border bg-surface-raised p-6 shadow-dialog"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg">
              <TbRocket size={18} />
            </span>
            <div>
              <h1 className="text-sm font-semibold leading-tight">AstroCMS</h1>
              <p className="text-xs text-text-muted">Sign in to continue</p>
            </div>
          </div>
          <Field label="Password" htmlFor="astrocms-password" error={error}>
            <Input
              id="astrocms-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={submitting || !password}
          >
            {submitting ? 'Signing in' : 'Sign in'}
          </Button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
