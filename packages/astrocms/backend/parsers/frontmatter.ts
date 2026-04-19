import { readFile, stat } from 'fs/promises'
import { extname } from 'path'
import YAML from 'yaml'

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/

const cache = new Map<
  string,
  { mtimeMs: number; frontmatter: Record<string, unknown> }
>()

/**
 * Read & parse frontmatter for a supported content file.
 * Cached in-memory; re-parsed only when the file's mtime changes.
 *
 * For .md/.mdx: parses the YAML frontmatter block.
 * For .yaml/.yml/.json: parses the whole document as frontmatter.
 */
export async function getFrontmatter(
  absPath: string
): Promise<Record<string, unknown>> {
  let mtimeMs: number
  try {
    const s = await stat(absPath)
    mtimeMs = s.mtimeMs
  } catch {
    return {}
  }

  const cached = cache.get(absPath)
  if (cached && cached.mtimeMs === mtimeMs) return cached.frontmatter

  const ext = extname(absPath)
  let frontmatter: Record<string, unknown> = {}
  try {
    const content = await readFile(absPath, 'utf-8')
    if (ext === '.md' || ext === '.mdx') {
      const m = content.match(FRONTMATTER_RE)
      if (m) {
        const parsed = YAML.parse(m[1])
        if (parsed && typeof parsed === 'object') frontmatter = parsed
      }
    } else if (ext === '.yaml' || ext === '.yml') {
      const parsed = YAML.parse(content)
      if (parsed && typeof parsed === 'object') frontmatter = parsed
    } else if (ext === '.json') {
      const parsed = JSON.parse(content)
      if (parsed && typeof parsed === 'object') frontmatter = parsed
    }
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
