import type { MediaRoot, PublicConfig } from '../../../api.js'
import { joinPath, normalizePath } from './paths.js'

export type MediaRootDirs = Pick<PublicConfig, 'contentDir' | 'assetsDir'>

/**
 * Fallback used until the public config is loaded. It keeps the historical
 * behavior where content and assets were assumed to be sibling folders.
 */
export const DEFAULT_MEDIA_ROOT_DIRS: MediaRootDirs = {
  contentDir: 'content',
  assetsDir: 'assets',
}

function rootDir(dirs: MediaRootDirs, root: MediaRoot): string | null {
  const dir = root === 'content' ? dirs.contentDir : dirs.assetsDir
  return dir === null ? null : normalizePath(dir)
}

/** Path of an entry relative to the project root (e.g. "src/content/blog/a.png"). */
export function projectPath(
  dirs: MediaRootDirs,
  root: MediaRoot,
  path: string
): string {
  return joinPath(rootDir(dirs, root) ?? root, path)
}

/**
 * Split a project-relative path into the root that contains it and the path
 * inside that root. Returns null when the path belongs to neither root.
 */
export function splitProjectPath(
  dirs: MediaRootDirs,
  path: string
): { root: MediaRoot; path: string } | null {
  for (const root of ['content', 'assets'] as const) {
    const dir = rootDir(dirs, root)
    if (dir === null) continue
    if (dir === '') return { root, path }
    if (path.startsWith(`${dir}/`)) {
      return { root, path: path.slice(dir.length + 1) }
    }
  }
  return null
}

/** URL under which the CMS server serves a file from a root. */
export function mediaPreviewUrl(root: MediaRoot, path: string): string {
  return `/astrocms/${root}/${path}`
}
