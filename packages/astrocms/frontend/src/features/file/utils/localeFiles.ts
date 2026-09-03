import type { TreeNode } from '../../../api.js'
import { findNode } from '../../common/utils/findNode.js'
import { parentOf } from '../../common/utils/paths.js'

export function extOf(name: string): string {
  return name.match(/\.[^.]+$/)?.[0] ?? ''
}

export function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

export function isLocaleFilename(name: string): boolean {
  return stripExt(name).length === 2
}

/** 2-char lang codes of sibling files in the given folder (empty = root). */
export function usedLangsInFolder(
  tree: TreeNode[],
  folderPath: string
): string[] {
  const children = folderPath
    ? findNode(tree, folderPath)?.children ?? []
    : tree
  return children
    .filter((c) => c.type === 'file' && isLocaleFilename(c.name))
    .map((c) => stripExt(c.name))
}

/**
 * When a locale file is deleted, returns the path of the first remaining
 * locale sibling (alphabetical), or null if the deleted file isn't a locale
 * file or no other locale sibling exists.
 */
export function firstRemainingLocaleSibling(
  tree: TreeNode[],
  deletedPath: string
): string | null {
  const deletedName = deletedPath.split('/').pop() ?? ''
  if (!isLocaleFilename(deletedName)) return null
  const folderPath = parentOf(deletedPath)
  const children = folderPath
    ? findNode(tree, folderPath)?.children ?? []
    : tree
  const remaining = children
    .filter(
      (c) =>
        c.type === 'file' &&
        isLocaleFilename(c.name) &&
        c.path !== deletedPath
    )
    .sort((a, b) => a.name.localeCompare(b.name))
  return remaining[0]?.path ?? null
}
