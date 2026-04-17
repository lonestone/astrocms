import { Hono } from 'hono'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { ROOT_DIR } from '../root.js'
import { loadConfig } from '../config.js'
import { parseContentSchemas } from './schema.js'

// Cache parsed schemas (parsed once, invalidated on server restart)
let schemasCache:
  | { schemas: Record<string, any[]>; error?: string }
  | undefined

async function getSchemas() {
  if (!schemasCache) {
    try {
      schemasCache = { schemas: await parseContentSchemas() }
    } catch (err) {
      console.error('[astrocms] Failed to parse content schemas:', err)
      schemasCache = { schemas: {}, error: err instanceof Error ? err.message : String(err) }
    }
  }
  return schemasCache
}

/** Derive collection name from file path (first segment) */
function getCollectionFromPath(
  filePath: string,
  schemas: Record<string, any[]>
): string | undefined {
  const first = filePath.split('/')[0]
  return first && first in schemas ? first : undefined
}

export const fileRoutes = new Hono()

// Read a file (path is relative to CONTENT_DIR)
fileRoutes.get('/', async (c) => {
  const filePath = c.req.query('path')
  if (!filePath) {
    return c.json({ error: 'Missing path parameter' }, 400)
  }

  if (filePath.includes('..')) {
    return c.json({ error: 'Invalid path' }, 400)
  }

  const config = await loadConfig()
  const fullPath = join(ROOT_DIR, config.contentDir, filePath)

  let content: string
  try {
    content = await readFile(fullPath, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return c.json({ error: 'File not found' }, 404)
    }
    console.error('[astrocms] Failed to read file:', fullPath, err)
    return c.json({ error: 'Failed to read file' }, 500)
  }

  // Include frontmatter schema if the file belongs to a known collection
  const { schemas, error: schemaError } = await getSchemas()
  const collection = getCollectionFromPath(filePath, schemas)
  const frontmatterSchema = collection ? schemas[collection] : undefined

  return c.json({ path: filePath, content, frontmatterSchema, schemaError })
})

// Write a file (path is relative to CONTENT_DIR)
fileRoutes.post('/', async (c) => {
  const body = await c.req.json<{ path: string; content: string }>()
  if (!body.path || body.content === undefined) {
    return c.json({ error: 'Missing path or content' }, 400)
  }

  if (body.path.includes('..')) {
    return c.json({ error: 'Invalid path' }, 400)
  }

  try {
    const config = await loadConfig()
    const fullPath = join(ROOT_DIR, config.contentDir, body.path)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, body.content, 'utf-8')
    return c.json({ ok: true, path: body.path })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})
