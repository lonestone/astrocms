import {
  DEFAULT_MEDIA_ROOT_DIRS,
  mediaPreviewUrl,
  projectPath,
  splitProjectPath,
  type MediaRootDirs,
} from '../../common/utils/mediaRoots.js'
import { joinPath, normalizePath, parentOf } from '../../common/utils/paths.js'

/**
 * Resolve a relative image source path to a preview URL served by the CMS.
 *
 * - `./image.png` or `image.png` → `/astrocms/content/{dir}/image.png`
 * - `../../assets/images/foo.png` → served from `/astrocms/assets/` when it
 *   lands inside the configured assets directory
 * - Absolute or http URLs are returned as-is.
 */
export function resolvePreviewSrc(
  src: string,
  filePath: string,
  dirs: MediaRootDirs = DEFAULT_MEDIA_ROOT_DIRS
): string | undefined {
  if (!src) return undefined
  if (src.startsWith('/') || src.startsWith('http')) return src

  const fileDir = parentOf(projectPath(dirs, 'content', filePath))
  const resolved = normalizePath(joinPath(fileDir, src))
  if (resolved === null) return undefined

  const target = splitProjectPath(dirs, resolved)
  if (!target) return undefined
  return mediaPreviewUrl(target.root, target.path)
}
