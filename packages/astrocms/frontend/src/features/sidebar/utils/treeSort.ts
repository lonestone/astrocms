import type { TreeNode } from '../../../api.js'
import { getFolderTarget } from '../../common/utils/folderTarget.js'
import {
  isSupportedFile,
  stripExtension,
} from '../../common/utils/supportedFiles.js'
import { DEFAULT_SORT, type FolderSort } from '../hooks/useFolderSort.js'

function compareValues(a: unknown, b: unknown): number {
  const aNull = a === undefined || a === null || a === ''
  const bNull = b === undefined || b === null || b === ''
  if (aNull && bNull) return 0
  if (aNull) return 1
  if (bNull) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  const as = String(a)
  const bs = String(b)
  const ad = Date.parse(as)
  const bd = Date.parse(bs)
  if (
    !isNaN(ad) &&
    !isNaN(bd) &&
    /\d{4}-\d{2}-\d{2}/.test(as) &&
    /\d{4}-\d{2}-\d{2}/.test(bs)
  ) {
    return ad - bd
  }
  return as.localeCompare(bs)
}

export function formatSortValue(v: unknown): string {
  if (v === undefined || v === null || v === '') return ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10)
  return s
}

/**
 * File path whose frontmatter should represent this folder for a sort/name
 * lookup. Extends `getFolderTarget`: an `index.*` file is used even when it
 * lives next to other files, since it typically carries the folder's meta.
 */
function findDataRepresentative(
  node: TreeNode,
  preferredLang?: string | null
): string | null {
  const strict = getFolderTarget(node, preferredLang)
  if (strict) return strict
  if (node.type !== 'directory' || !node.children) return null
  const index = node.children.find(
    (c) =>
      c.type === 'file' &&
      isSupportedFile(c.name) &&
      stripExtension(c.name) === 'index'
  )
  return index?.path ?? null
}

/**
 * Pick the descendant file value that matches the sort direction (max for
 * desc, min for asc). Used when a folder has no clear representative so its
 * position reflects the extreme of its contents.
 */
function aggregateDescendantValue(
  node: TreeNode,
  field: string,
  order: 'asc' | 'desc'
): unknown {
  const values: unknown[] = []
  function walk(n: TreeNode) {
    if (n.type === 'file') {
      const v = n.data?.[field]
      if (v !== undefined && v !== null && v !== '') values.push(v)
      return
    }
    for (const c of n.children ?? []) walk(c)
  }
  for (const c of node.children ?? []) walk(c)
  if (values.length === 0) return undefined
  const sorted = [...values].sort(compareValues)
  return order === 'desc' ? sorted[sorted.length - 1] : sorted[0]
}

/**
 * Read a field from a node's data. Files carry data directly; a folder uses
 * its representative (index.* or preferred-lang file) when available, and
 * falls back to an aggregate of its descendants when `aggregateOrder` is
 * provided.
 */
export function getNodeFieldValue(
  node: TreeNode,
  field: string,
  preferredLang?: string | null,
  aggregateOrder?: 'asc' | 'desc'
): unknown {
  if (node.type === 'file') return node.data?.[field]
  const repPath = findDataRepresentative(node, preferredLang)
  if (repPath) {
    const target = node.children?.find((c) => c.path === repPath)
    const v = target?.data?.[field]
    if (v !== undefined) return v
  }
  if (aggregateOrder) {
    return aggregateDescendantValue(node, field, aggregateOrder)
  }
  return undefined
}

export function sortTreeChildren(
  children: TreeNode[],
  sort: FolderSort,
  preferredLang?: string | null
): TreeNode[] {
  if (sort.field === DEFAULT_SORT.field) {
    const sorted = [...children]
    return sort.order === 'desc' ? sorted.reverse() : sorted
  }
  const sorted = [...children].sort((a, b) => {
    const cmp = compareValues(
      getNodeFieldValue(a, sort.field, preferredLang, sort.order),
      getNodeFieldValue(b, sort.field, preferredLang, sort.order)
    )
    if (cmp !== 0) return cmp
    return a.name.localeCompare(b.name)
  })
  return sort.order === 'desc' ? sorted.reverse() : sorted
}
