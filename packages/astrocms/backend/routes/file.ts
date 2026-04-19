import { Hono } from 'hono'
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  stat,
  rm,
  access,
} from 'fs/promises'
import { join, dirname, relative, resolve } from 'path'
import { ROOT_DIR } from '../root.js'
import { loadConfig } from '../config.js'

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

  return c.json({ path: filePath, content })
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

function isValidRelPath(p: unknown): p is string {
  return typeof p === 'string' && p.length > 0 && !p.includes('..')
}

async function resolveSafe(relPath: string): Promise<string> {
  const config = await loadConfig()
  const base = resolve(ROOT_DIR, config.contentDir)
  const full = resolve(base, relPath)
  const rel = relative(base, full)
  if (rel.startsWith('..') || resolve(base, rel) !== full) {
    throw new Error('Invalid path')
  }
  return full
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

// Create a new file (with default content)
fileRoutes.post('/create', async (c) => {
  const body = await c.req.json<{ path: string; content?: string }>()
  if (!isValidRelPath(body.path)) {
    return c.json({ error: 'Invalid path' }, 400)
  }
  try {
    const fullPath = await resolveSafe(body.path)
    if (await pathExists(fullPath)) {
      return c.json({ error: 'File already exists' }, 409)
    }
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, body.content ?? '', 'utf-8')
    return c.json({ ok: true, path: body.path })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// Rename / move a file or folder
fileRoutes.post('/rename', async (c) => {
  const body = await c.req.json<{ from: string; to: string }>()
  if (!isValidRelPath(body.from) || !isValidRelPath(body.to)) {
    return c.json({ error: 'Invalid path' }, 400)
  }
  try {
    const fromPath = await resolveSafe(body.from)
    const toPath = await resolveSafe(body.to)
    if (!(await pathExists(fromPath))) {
      return c.json({ error: 'Source not found' }, 404)
    }
    if (await pathExists(toPath)) {
      return c.json({ error: 'Destination already exists' }, 409)
    }
    await mkdir(dirname(toPath), { recursive: true })
    await rename(fromPath, toPath)
    return c.json({ ok: true, path: body.to })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// Duplicate a file or folder (recursive copy)
fileRoutes.post('/duplicate', async (c) => {
  const body = await c.req.json<{ from: string; to: string }>()
  if (!isValidRelPath(body.from) || !isValidRelPath(body.to)) {
    return c.json({ error: 'Invalid path' }, 400)
  }
  try {
    const fromPath = await resolveSafe(body.from)
    const toPath = await resolveSafe(body.to)
    if (!(await pathExists(fromPath))) {
      return c.json({ error: 'Source not found' }, 404)
    }
    if (await pathExists(toPath)) {
      return c.json({ error: 'Destination already exists' }, 409)
    }
    await mkdir(dirname(toPath), { recursive: true })
    const s = await stat(fromPath)
    if (s.isDirectory()) {
      const { cp } = await import('fs/promises')
      await cp(fromPath, toPath, { recursive: true })
    } else {
      const content = await readFile(fromPath)
      await writeFile(toPath, content)
    }
    return c.json({ ok: true, path: body.to })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// Delete a file or folder (recursive)
fileRoutes.post('/delete', async (c) => {
  const body = await c.req.json<{ path: string }>()
  if (!isValidRelPath(body.path)) {
    return c.json({ error: 'Invalid path' }, 400)
  }
  try {
    const fullPath = await resolveSafe(body.path)
    if (!(await pathExists(fullPath))) {
      return c.json({ error: 'Not found' }, 404)
    }
    await rm(fullPath, { recursive: true, force: true })
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})
