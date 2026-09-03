import { resolve } from 'path'
import { ROOT_DIR } from './root.js'
import { loadConfig } from './config.js'

/** Browsable roots exposed by the CMS: the content dir and the optional assets dir. */
export type MediaRoot = 'content' | 'assets'

export function parseRoot(raw: unknown): MediaRoot | null {
  if (raw === undefined || raw === null || raw === '' || raw === 'content') {
    return 'content'
  }
  if (raw === 'assets') return 'assets'
  return null
}

/**
 * Absolute directory for a root, or null when the root is not configured
 * (assetsDir is optional).
 */
export async function resolveRootDir(root: MediaRoot): Promise<string | null> {
  const config = await loadConfig()
  if (root === 'assets') {
    return config.assetsDir ? resolve(ROOT_DIR, config.assetsDir) : null
  }
  return resolve(ROOT_DIR, config.contentDir)
}
