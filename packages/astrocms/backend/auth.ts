import { createHmac, timingSafeEqual } from 'crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'

export const AUTH_COOKIE = 'astrocms_auth'

const PASSWORD = process.env.ASTROCMS_PASSWORD ?? ''
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export function isAuthRequired(): boolean {
  return PASSWORD.length > 0
}

export function checkPassword(input: string): boolean {
  return isAuthRequired() && input === PASSWORD
}

function sign(payload: string): string {
  return createHmac('sha256', PASSWORD).update(payload).digest('hex')
}

export function createToken(): string {
  const payload = Date.now().toString(36)
  return `${payload}.${sign(payload)}`
}

export function isValidToken(token: string | undefined): boolean {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot < 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(payload)
  if (sig.length !== expected.length) return false
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  if (!timingSafeEqual(a, b)) return false
  const ts = parseInt(payload, 36)
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts <= MAX_AGE_MS
}

export function getSessionToken(c: Context): string | undefined {
  return getCookie(c, AUTH_COOKIE)
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (!isAuthRequired()) return next()
  if (c.req.path.startsWith('/api/auth/')) return next()
  const token = getSessionToken(c)
  if (!isValidToken(token)) return c.json({ error: 'Unauthorized' }, 401)
  return next()
}
