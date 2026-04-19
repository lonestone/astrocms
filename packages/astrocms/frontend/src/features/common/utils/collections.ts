import type { CollectionInfo, FrontmatterFieldSchema } from '../../../api.js'

/**
 * Minimal glob-to-regex for Astro content patterns like:
 *   - `**\/*.mdx`
 *   - `**\/*.{md,mdx}`
 *   - `*.yaml`
 */
function globToRegex(pattern: string): RegExp {
  const groups: string[] = []
  let idx = 0
  let p = pattern.replace(/\{([^{}]+)\}/g, (_, g) => {
    groups.push(g)
    return `\x00${idx++}\x00`
  })
  p = p.replace(/[.+^$|()\\[\]]/g, '\\$&')
  p = p
    .replace(/\*\*\//g, '\x01')
    .replace(/\*\*/g, '\x02')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\x01/g, '(?:.*/)?')
    .replace(/\x02/g, '.*')
  p = p.replace(/\x00(\d+)\x00/g, (_, i) => {
    const alts = groups[Number(i)]
      .split(',')
      .map((s) => s.replace(/[.+^$|()\\[\]*?]/g, '\\$&'))
    return `(?:${alts.join('|')})`
  })
  return new RegExp(`^${p}$`)
}

export function matchGlob(
  filePath: string,
  patterns: string | string[]
): boolean {
  const list = Array.isArray(patterns) ? patterns : [patterns]
  return list.some((p) => globToRegex(p).test(filePath))
}

/**
 * Find the collection that owns a given file based on its path and the
 * collection's glob pattern/base. Falls back to first-segment match when
 * the collection has no loader info.
 */
export function resolveCollection(
  filePath: string,
  collections: Record<string, CollectionInfo>
): string | undefined {
  for (const [name, info] of Object.entries(collections)) {
    if (info.loader === 'file' && info.filePath) {
      if (filePath === info.filePath) return name
    } else if (info.base !== undefined && info.pattern !== undefined) {
      const prefix = info.base ? info.base + '/' : ''
      if (info.base && !filePath.startsWith(prefix)) continue
      const rel = info.base ? filePath.slice(prefix.length) : filePath
      if (matchGlob(rel, info.pattern)) return name
    } else if (filePath.split('/')[0] === name) {
      return name
    }
  }
  return undefined
}

export function getSchemaForFile(
  filePath: string,
  collections: Record<string, CollectionInfo>
): FrontmatterFieldSchema[] | undefined {
  const name = resolveCollection(filePath, collections)
  if (!name) return undefined
  const info = collections[name]
  // With a `file` loader the data file holds a dict of entries; the schema
  // describes one entry and doesn't map to the file as a whole. Let the
  // editor infer from data instead.
  if (info.loader === 'file') return undefined
  return info.schema ?? undefined
}
