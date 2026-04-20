import type { TreeNode } from '../../../api.js'
import { getFolderTarget } from '../../common/utils/folderTarget.js'
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
 * Read a field from a node's data. Files carry data directly; a folder that
 * collapses to a single target file (index.* or the first locale) borrows
 * that target's data.
 */
export function getNodeFieldValue(node: TreeNode, field: string): unknown {
  if (node.type === 'file') return node.data?.[field]
  const targetPath = getFolderTarget(node)
  if (!targetPath) return undefined
  const target = node.children?.find((c) => c.path === targetPath)
  return target?.data?.[field]
}

export function sortTreeChildren(
  children: TreeNode[],
  sort: FolderSort
): TreeNode[] {
  if (sort.field === DEFAULT_SORT.field) {
    const sorted = [...children]
    return sort.order === 'desc' ? sorted.reverse() : sorted
  }
  const sorted = [...children].sort((a, b) => {
    const cmp = compareValues(
      getNodeFieldValue(a, sort.field),
      getNodeFieldValue(b, sort.field)
    )
    if (cmp !== 0) return cmp
    return a.name.localeCompare(b.name)
  })
  return sort.order === 'desc' ? sorted.reverse() : sorted
}
