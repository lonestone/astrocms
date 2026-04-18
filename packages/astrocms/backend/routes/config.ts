import { Hono } from 'hono'

export const configRoutes = new Hono()

configRoutes.get('/', (c) => {
  return c.json({ devServer: !!process.env.ASTROCMS_DEV_CMD })
})
