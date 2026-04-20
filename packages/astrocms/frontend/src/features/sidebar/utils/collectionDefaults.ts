import type { FrontmatterFieldSchema } from '../../../api.js'
import { DEFAULT_SORT, type FolderSort } from '../hooks/useFolderSort.js'

/** Reserved identifier used to mean "filename" in sort/name selectors. */
export const FILENAME_FIELD = DEFAULT_SORT.field

interface FlatField {
  path: string
  type: FrontmatterFieldSchema['type']
}

function flatten(
  fields: FrontmatterFieldSchema[],
  prefix = ''
): FlatField[] {
  const out: FlatField[] = []
  for (const f of fields) {
    const path = prefix ? `${prefix}.${f.name}` : f.name
    if (f.type === 'object' && f.children) {
      out.push(...flatten(f.children, path))
    } else {
      out.push({ path, type: f.type })
    }
  }
  return out
}

export interface SelectableField {
  path: string
  type: FrontmatterFieldSchema['type']
}

/** Flat list of scalar-ish fields usable in sort/name pickers. */
export function flatSelectableFields(
  schema: FrontmatterFieldSchema[] | undefined | null
): SelectableField[] {
  if (!schema) return []
  return flatten(schema).filter(
    (f) =>
      f.type === 'string' ||
      f.type === 'number' ||
      f.type === 'boolean' ||
      f.type === 'date' ||
      f.type === 'select'
  )
}

/** True when a field should default to descending order (date-like). */
export function isDateLikeField(field: SelectableField): boolean {
  if (field.type === 'date') return true
  return field.path.toLowerCase().includes('date')
}

/** Default field to render each entry's label with. `title` wins over `name`. */
export function getDefaultNameField(
  schema: FrontmatterFieldSchema[] | undefined | null
): string {
  if (!schema) return FILENAME_FIELD
  const paths = flatSelectableFields(schema).map((f) => f.path)
  if (paths.includes('title')) return 'title'
  if (paths.includes('name')) return 'name'
  return FILENAME_FIELD
}

/**
 * Best-guess default sort for a collection. Prefers fields whose name contains
 * "date" (descending, typical for feeds), with a priority boost for fields
 * mentioning creation or publication.
 */
export function getDefaultSort(
  schema: FrontmatterFieldSchema[] | undefined | null
): FolderSort {
  if (!schema) return DEFAULT_SORT
  const flat = flatten(schema)
  let bestTier = Infinity
  let best: string | null = null
  for (const f of flat) {
    const lower = f.path.toLowerCase()
    const hasDate = f.type === 'date' || lower.includes('date')
    if (!hasDate) continue
    const tier =
      lower.includes('crea') || lower.includes('publi') ? 0 : 1
    if (tier < bestTier) {
      bestTier = tier
      best = f.path
    }
  }
  if (best) return { field: best, order: 'desc' }
  return DEFAULT_SORT
}
