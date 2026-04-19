import { Hono } from 'hono'
import { getCollections } from '../parsers/schemas.js'

export const collectionsRoutes = new Hono()

collectionsRoutes.get('/', async (c) => {
  const { collections, error } = await getCollections()
  return c.json({ collections, error })
})
