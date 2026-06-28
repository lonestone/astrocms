import picomatch from 'picomatch'
import type { CollectionInfo, FrontmatterFieldSchema } from '../../../api.js'

/**
 * Match a file path (forward-slash separated, relative to the base) against
 * one or more glob patterns.
 *
 * Delegates to `picomatch`, the exact engine Astro's `glob()` loader uses to
 * decide collection membership, so the behavior here stays identical to Astro
 * for `**`, `*`, `?`, `{a,b}` brace groups, and `[...]` / `[^...]` / `[!...]`
 * character classes. Kept in sync with the backend's `parsers/glob.ts`.
 */
export function matchGlob(
  filePath: string,
  patterns: string | string[]
): boolean {
  return picomatch.isMatch(filePath, patterns)
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

/**
 * Folder paths (relative to contentDir) that are collection roots. For a
 * glob-loader collection we use its `base` when defined, otherwise fall back
 * to the collection name. File-loader collections have no folder counterpart.
 */
export function getCollectionFolderPaths(
  collections: Record<string, CollectionInfo>
): Set<string> {
  const out = new Set<string>()
  for (const [name, info] of Object.entries(collections)) {
    if (info.loader === 'file') continue
    if (info.base) out.add(info.base)
    else out.add(name)
  }
  return out
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
