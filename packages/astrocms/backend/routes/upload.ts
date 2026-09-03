import { Hono } from 'hono'
import { writeFile, mkdir } from 'fs/promises'
import { join, relative, resolve } from 'path'
import { parseRoot, resolveRootDir } from '../roots.js'

export const uploadRoutes = new Hono()

// Upload a media file. `targetDir` is relative to the chosen root, which is
// "content" (default) or "assets".
uploadRoutes.post('/', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const targetDir = formData.get('targetDir')
  const root = parseRoot(formData.get('root'))

  if (!file || typeof targetDir !== 'string') {
    return c.json({ error: 'Missing file or targetDir' }, 400)
  }
  if (!root) return c.json({ error: 'Invalid root' }, 400)

  const rootDir = await resolveRootDir(root)
  if (!rootDir) return c.json({ error: 'Root not configured' }, 404)

  const fullDir = resolve(rootDir, targetDir)
  const rel = relative(rootDir, fullDir)
  if (rel.startsWith('..') || file.name.includes('/') || file.name.includes('..')) {
    return c.json({ error: 'Invalid path' }, 400)
  }
  await mkdir(fullDir, { recursive: true })

  const relPath = join(targetDir, file.name)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(join(fullDir, file.name), buffer)

  return c.json({ ok: true, path: relPath, name: file.name, root })
})
