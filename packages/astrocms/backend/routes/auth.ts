import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import {
  AUTH_COOKIE,
  checkPassword,
  createToken,
  getSessionToken,
  isAuthRequired,
  isValidToken,
} from '../auth.js'

export const authRoutes = new Hono()

authRoutes.get('/status', (c) => {
  const required = isAuthRequired()
  const authenticated = !required || isValidToken(getSessionToken(c))
  return c.json({ required, authenticated })
})

authRoutes.post('/login', async (c) => {
  if (!isAuthRequired()) {
    return c.json({ error: 'Auth not configured' }, 400)
  }
  const body = await c.req.json().catch(() => ({}))
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!checkPassword(password)) {
    return c.json({ error: 'Invalid password' }, 401)
  }
  const token = createToken()
  setCookie(c, AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return c.json({ ok: true })
})

authRoutes.post('/logout', (c) => {
  deleteCookie(c, AUTH_COOKIE, { path: '/' })
  return c.json({ ok: true })
})
