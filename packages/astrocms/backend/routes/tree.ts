import { Hono } from 'hono'
import { readdir } from 'fs/promises'
import { join, relative, basename, extname } from 'path'
import { ROOT_DIR } from '../root.js'
import { loadConfig } from '../config.js'
import { getFrontmatter, getByPath } from '../parsers/frontmatter.js'

const SUPPORTED_EXTS = ['.mdx', '.md', '.yaml', '.yml', '.toml', '.json']

function isSupported(name: string): boolean {
  return SUPPORTED_EXTS.some((ext) => name.endsWith(ext))
}

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
  sortValue?: unknown
}

/**
 * For a tree child that represents a single logical entry (either a file or
 * a "collapsed folder" holding an index.* or 2-letter locale files), return
 * the absolute path to the file whose frontmatter should be read.
 */
async function resolveSourceAbs(
  childAbs: string,
  type: 'file' | 'directory'
): Promise<string | null> {
  if (type === 'file') return childAbs
  try {
    const entries = await readdir(childAbs, { withFileTypes: true })
    const supported = entries.filter((e) => e.isFile() && isSupported(e.name))
    const indexFile = supported.find(
      (e) => basename(e.name, extname(e.name)) === 'index'
    )
    if (indexFile) return join(childAbs, indexFile.name)
    const allLocale =
      supported.length > 0 &&
      supported.every((e) => basename(e.name, extname(e.name)).length === 2)
    if (allLocale) {
      const first = [...supported].sort((a, b) =>
        a.name.localeCompare(b.name)
      )[0]
      return join(childAbs, first.name)
    }
  } catch {}
  return null
}

async function buildTree(
  dir: string,
  contentRoot: string,
  sortByFolder: Map<string, string>
): Promise<TreeNode[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nodes: TreeNode[] = []

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(dir, entry.name)
    const relPath = relative(contentRoot, fullPath)
    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, contentRoot, sortByFolder)
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

  // If this folder has a sort field requested, attach sortValue to each child.
  const dirRel = relative(contentRoot, dir)
  const field = sortByFolder.get(dirRel)
  if (field) {
    await Promise.all(
      nodes.map(async (child) => {
        const source = await resolveSourceAbs(
          join(dir, child.name),
          child.type
        )
        if (!source) return
        const fm = await getFrontmatter(source)
        const v = getByPath(fm, field)
        if (v !== undefined) child.sortValue = v as unknown
      })
    )
  }

  return nodes
}

function parseSortParams(raw: string[]): Map<string, string> {
  // Each entry: "<folderPath>:<fieldName>". folderPath may be empty for root.
  const out = new Map<string, string>()
  for (const p of raw) {
    const idx = p.indexOf(':')
    if (idx < 0) continue
    const folder = p.slice(0, idx)
    const field = p.slice(idx + 1)
    if (field) out.set(folder, field)
  }
  return out
}

export const treeRoutes = new Hono()

treeRoutes.get('/', async (c) => {
  const config = await loadConfig()
  const contentRoot = join(ROOT_DIR, config.contentDir)
  const url = new URL(c.req.url)
  const sortByFolder = parseSortParams(url.searchParams.getAll('sort'))
  const tree = await buildTree(contentRoot, contentRoot, sortByFolder)
  return c.json(tree)
})
