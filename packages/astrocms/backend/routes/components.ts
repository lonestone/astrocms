import { Hono } from 'hono'
import { scanComponents } from '../parsers/components.js'

export const componentsRoutes = new Hono()

componentsRoutes.get('/', async (c) => {
  const components = await scanComponents()
  return c.json(components)
})
