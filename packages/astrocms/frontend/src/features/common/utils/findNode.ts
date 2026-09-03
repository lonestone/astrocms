import type { TreeNode } from '../../../api.js'

/** Depth-first lookup of a tree node by its path. */
export function findNode(
  nodes: TreeNode[],
  path: string
): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNode(node.children, path)
      if (found) return found
    }
  }
  return undefined
}
