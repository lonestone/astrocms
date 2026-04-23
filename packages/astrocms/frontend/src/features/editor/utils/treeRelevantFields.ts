import type { CollectionInfo } from '../../../api.js'
import { resolveCollection } from '../../common/utils/collections.js'
import {
  FILENAME_FIELD,
  getDefaultNameField,
  getDefaultSort,
} from '../../sidebar/utils/collectionDefaults.js'
import type { FrontmatterData } from '../../../../../shared/frontmatter.js'

/**
 * Fields whose value drives the sidebar tree (sort field + display-name
 * field) for the collection that owns `filePath`. Empty when the file is
 * outside a collection, or when both resolve to the filename.
 */
export function getTreeRelevantFields(
  filePath: string,
  collections: Record<string, CollectionInfo>,
  savedSorts: Record<string, { field: string; order: 'asc' | 'desc' }>,
  savedNames: Record<string, string>
): string[] {
  const collectionName = resolveCollection(filePath, collections)
  if (!collectionName) return []
  const info = collections[collectionName]
  if (!info || info.loader === 'file') return []
  const folder = info.base ?? collectionName
  const schema = info.schema ?? undefined
  const sort = savedSorts[folder] ?? getDefaultSort(schema)
  const nameField = savedNames[folder] ?? getDefaultNameField(schema)
  const fields = new Set<string>()
  if (sort.field !== FILENAME_FIELD) fields.add(sort.field)
  if (nameField !== FILENAME_FIELD) fields.add(nameField)
  return [...fields]
}

function getDeep(data: FrontmatterData, path: string): unknown {
  const parts = path.split('.')
  let cursor: unknown = data
  for (const part of parts) {
    if (cursor == null || typeof cursor !== 'object') return undefined
    cursor = (cursor as Record<string, unknown>)[part]
  }
  return cursor
}

export function anyFieldChanged(
  fields: string[],
  before: FrontmatterData,
  after: FrontmatterData
): boolean {
  for (const field of fields) {
    const a = getDeep(before, field)
    const b = getDeep(after, field)
    if (JSON.stringify(a) !== JSON.stringify(b)) return true
  }
  return false
}
