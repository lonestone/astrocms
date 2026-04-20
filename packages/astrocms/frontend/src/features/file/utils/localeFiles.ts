import type { TreeNode } from '../../../api.js'

export function extOf(name: string): string {
  return name.match(/\.[^.]+$/)?.[0] ?? ''
}

export function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

export function isLocaleFilename(name: string): boolean {
  return stripExt(name).length === 2
}

function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.path === path) return n
    if (n.children) {
      const found = findNode(n.children, path)
      if (found) return found
    }
  }
  return undefined
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
