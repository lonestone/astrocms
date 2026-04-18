import React, { useEffect, useState } from 'react'
import { fetchAuthStatus, login, onAuthRequired } from '../../../api.js'
import Button from '../../common/components/Button.js'

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
      <div className="flex h-screen items-center justify-center text-text-muted">
        Chargement…
      </div>
    )
  }

  if (status === 'gated') {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-main">
        <form
          onSubmit={handleSubmit}
          className="flex w-80 flex-col gap-3 rounded-md border border-border bg-white p-6 shadow-sm"
        >
          <h1 className="text-lg font-semibold">AstroCMS</h1>
          <label htmlFor="astrocms-password" className="text-sm text-text-muted">
            Mot de passe
          </label>
          <input
            id="astrocms-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="rounded-md border border-border bg-white px-2 py-1 text-sm outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !password}
          >
            {submitting ? '…' : 'Se connecter'}
          </Button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
