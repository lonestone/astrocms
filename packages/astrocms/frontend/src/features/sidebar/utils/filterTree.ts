import type { TreeNode } from '../../../api.js'
import {
  isSupportedFile,
  stripExtension,
} from '../../common/utils/supportedFiles.js'
import { fuzzyMatch } from './fuzzyMatch.js'

export interface FilterResult {
  /** Filtered tree (only branches containing at least one match). */
  nodes: TreeNode[]
  /** Folders to force-open so matches are visible. */
  expand: Set<string>
}

const EMPTY: FilterResult = {
  nodes: [],
  expand: new Set(),
}

function collectDataTexts(value: unknown, out: string[]): void {
  if (value === null || value === undefined) return
  if (typeof value === 'string') {
    if (value) out.push(value)
    return
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    out.push(String(value))
    return
  }
  if (value instanceof Date) {
    out.push(value.toISOString().slice(0, 10))
    return
  }
  if (Array.isArray(value)) {
    for (const v of value) collectDataTexts(v, out)
    return
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value)) collectDataTexts(v, out)
  }
}

function dataMatches(
  data: Record<string, unknown> | undefined,
  q: string
): boolean {
  if (!data) return false
  const texts: string[] = []
  collectDataTexts(data, texts)
  return texts.some((t) => fuzzyMatch(t, q))
}

export function filterTree(tree: TreeNode[], query: string): FilterResult {
  const q = query.trim()
  if (!q) {
    return { nodes: tree, expand: EMPTY.expand }
  }

  const expand = new Set<string>()

  /**
   * Match each node against its own name segment (files use their base name
   * minus extension) and its loaded frontmatter `data`. When a folder matches,
   * every descendant is included as if it matched — this implements "path
   * matching" in effect, because the folder's name is part of every
   * descendant's path.
   *
   * @param forceInclude — true when an ancestor already matched.
   */
  function walk(node: TreeNode, forceInclude: boolean): TreeNode | null {
    const display = node.type === 'file' ? stripExtension(node.name) : node.name
    const selfMatch = !forceInclude && fuzzyMatch(display, q)
    const extraMatched =
      !forceInclude && !selfMatch && dataMatches(node.data, q)
    const matched = forceInclude || selfMatch || extraMatched

    if (node.type === 'file') {
      if (!isSupportedFile(node.name)) return null
      if (!matched) return null
      return node
    }

    const children: TreeNode[] = []
    for (const child of node.children ?? []) {
      const kept = walk(child, matched)
      if (kept) children.push(kept)
    }
    if (!matched && children.length === 0) return null

    if (children.length > 0) expand.add(node.path)
    return { ...node, children }
  }

  const nodes: TreeNode[] = []
  for (const node of tree) {
    const kept = walk(node, false)
    if (kept) nodes.push(kept)
  }

  return { nodes, expand }
}
