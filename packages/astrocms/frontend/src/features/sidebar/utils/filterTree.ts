import type { TreeNode } from '../../../api.js'
import {
  isSupportedFile,
  stripExtension,
} from '../../common/utils/supportedFiles.js'
import { fuzzyMatch } from './fuzzyMatch.js'

export interface FilterResult {
  /** Filtered tree (only branches containing at least one match). */
  nodes: TreeNode[]
  /** For each matched node's path, the match indices in its display name. */
  matchIndices: Map<string, number[]>
  /** Folders to force-open so matches are visible. */
  expand: Set<string>
}

const EMPTY: FilterResult = {
  nodes: [],
  matchIndices: new Map(),
  expand: new Set(),
}

export function filterTree(tree: TreeNode[], query: string): FilterResult {
  const q = query.trim()
  if (!q) {
    return {
      nodes: tree,
      matchIndices: EMPTY.matchIndices,
      expand: EMPTY.expand,
    }
  }

  const matchIndices = new Map<string, number[]>()
  const expand = new Set<string>()

  /**
   * Match each node against its own name segment (files use their base name
   * minus extension). When a folder matches, every descendant is included as
   * if it matched — this implements "path matching" in effect, because the
   * folder's name is part of every descendant's path.
   *
   * @param forceInclude — true when an ancestor already matched.
   */
  function walk(node: TreeNode, forceInclude: boolean): TreeNode | null {
    const display = node.type === 'file' ? stripExtension(node.name) : node.name
    const selfMatch = forceInclude ? null : fuzzyMatch(display, q)
    const matched = forceInclude || selfMatch !== null

    if (node.type === 'file') {
      if (!isSupportedFile(node.name)) return null
      if (!matched) return null
      if (selfMatch) matchIndices.set(node.path, selfMatch)
      return node
    }

    const children: TreeNode[] = []
    for (const child of node.children ?? []) {
      const kept = walk(child, matched)
      if (kept) children.push(kept)
    }
    if (!matched && children.length === 0) return null

    if (selfMatch) matchIndices.set(node.path, selfMatch)
    if (children.length > 0) expand.add(node.path)
    return { ...node, children }
  }

  const nodes: TreeNode[] = []
  for (const node of tree) {
    const kept = walk(node, false)
    if (kept) nodes.push(kept)
  }

  return { nodes, matchIndices, expand }
}
