import { Hono } from 'hono'
import { readdir } from 'fs/promises'
import { join, relative } from 'path'
import { ROOT_DIR } from '../root.js'
import { loadConfig } from '../config.js'
import { getFrontmatter, getByPath } from '../parsers/frontmatter.js'
import { matchGlob } from '../parsers/glob.js'

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
  data?: Record<string, unknown>
}

interface IncludeSpec {
  pattern: string
  fields: string[]
}

function parseIncludeParams(raw: string[]): IncludeSpec[] {
  // Each entry: "<glob>:<field1>[,<field2>...]".
  const out: IncludeSpec[] = []
  for (const p of raw) {
    const idx = p.indexOf(':')
    if (idx < 0) continue
    const pattern = p.slice(0, idx)
    const fields = p
      .slice(idx + 1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (pattern && fields.length) out.push({ pattern, fields })
  }
  return out
}

async function buildTree(
  dir: string,
  contentRoot: string,
  includes: IncludeSpec[]
): Promise<TreeNode[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nodes: TreeNode[] = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(dir, entry.name)
    const relPath = relative(contentRoot, fullPath)
    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, contentRoot, includes)
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'directory',
        children,
      })
    } else {
      nodes.push({ name: entry.name, path: relPath, type: 'file' })
    }
  }

  // Attach requested frontmatter fields to files whose path matches an
  // include glob. Folder grouping (index files, locale folders) stays on
  // the client, so directories are never inspected here.
  if (includes.length > 0) {
    await Promise.all(
      nodes.map(async (node) => {
        if (node.type !== 'file') return
        const fields = new Set<string>()
        for (const inc of includes) {
          if (matchGlob(node.path, inc.pattern)) {
            for (const f of inc.fields) fields.add(f)
          }
        }
        if (fields.size === 0) return
        const fm = await getFrontmatter(join(dir, node.name))
        const data: Record<string, unknown> = {}
        for (const f of fields) {
          const v = getByPath(fm, f)
          if (v !== undefined) data[f] = v
        }
        if (Object.keys(data).length > 0) node.data = data
      })
    )
  }

  return nodes
}

export const treeRoutes = new Hono()

treeRoutes.get('/', async (c) => {
  const config = await loadConfig()
  const contentRoot = join(ROOT_DIR, config.contentDir)
  const url = new URL(c.req.url)
  const includes = parseIncludeParams(url.searchParams.getAll('include'))
  const tree = await buildTree(contentRoot, contentRoot, includes)
  return c.json(tree)
})
