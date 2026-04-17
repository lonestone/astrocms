import { Hono } from 'hono'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { ROOT_DIR } from '../root.js'
import { loadConfig } from '../config.js'

export const uploadRoutes = new Hono()

// Upload a media file (targetDir is relative to CONTENT_DIR)
uploadRoutes.post('/', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const targetDir = formData.get('targetDir') as string | null

  if (!file || !targetDir) {
    return c.json({ error: 'Missing file or targetDir' }, 400)
  }

  if (targetDir.includes('..')) {
    return c.json({ error: 'Invalid path' }, 400)
  }

  const config = await loadConfig()
  const fullDir = join(ROOT_DIR, config.contentDir, targetDir)
  await mkdir(fullDir, { recursive: true })

  const relPath = join(targetDir, file.name)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(join(fullDir, file.name), buffer)

  return c.json({ ok: true, path: relPath, name: file.name })
})
