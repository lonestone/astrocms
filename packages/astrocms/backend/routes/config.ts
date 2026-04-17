import { Hono } from 'hono'
import { loadConfig } from '../config.js'

export const configRoutes = new Hono()

configRoutes.get('/', async (c) => {
  const config = await loadConfig()
  return c.json({
    websiteUrl: config.websiteUrl,
  })
})
