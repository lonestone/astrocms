import React, { useMemo } from 'react'
import type { FrontmatterFieldSchema } from '../../../api.js'
import { useFolderSort } from '../hooks/useFolderSort.js'
import { useFolderName } from '../hooks/useFolderName.js'
import {
  getDefaultNameField,
  getDefaultSort,
} from '../utils/collectionDefaults.js'
import { SortMenu } from './SortMenu.js'

interface Props {
  folderPath: string
  schema: FrontmatterFieldSchema[] | undefined
  x: number
  y: number
  onClose: () => void
}

export function SortMenuWrapper({
  folderPath,
  schema,
  x,
  y,
  onClose,
}: Props) {
  const smartSort = useMemo(() => getDefaultSort(schema), [schema])
  const smartName = useMemo(() => getDefaultNameField(schema), [schema])
  const { sort, setSort, clearSort } = useFolderSort(folderPath, smartSort)
  const { name, setName } = useFolderName(folderPath, smartName)

  return (
    <SortMenu
      x={x}
      y={y}
      schema={schema}
      currentSort={sort}
      currentName={name}
      onChangeSort={(next) => (next ? setSort(next) : clearSort())}
      onChangeName={setName}
      onClose={onClose}
    />
  )
}
