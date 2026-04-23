import { readFile, stat } from 'fs/promises'
import { extname } from 'path'
import {
  parseFileFrontmatter,
  type FrontmatterData,
} from '../../shared/frontmatter.js'

const cache = new Map<string, { mtimeMs: number; frontmatter: FrontmatterData }>()

/**
 * Read & parse frontmatter for a supported content file.
 * Cached in-memory; re-parsed only when the file's mtime changes.
 */
export async function getFrontmatter(absPath: string): Promise<FrontmatterData> {
  let mtimeMs: number
  try {
    const s = await stat(absPath)
    mtimeMs = s.mtimeMs
  } catch {
    return {}
  }

  const cached = cache.get(absPath)
  if (cached && cached.mtimeMs === mtimeMs) return cached.frontmatter

  let frontmatter: FrontmatterData = {}
  try {
    const content = await readFile(absPath, 'utf-8')
    frontmatter = parseFileFrontmatter(content, extname(absPath))
  } catch {
    frontmatter = {}
  }

  cache.set(absPath, { mtimeMs, frontmatter })
  return frontmatter
}

export function getByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  const parts = path.split('.')
  let cur: any = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}
