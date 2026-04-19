import React from 'react'
import type { FrontmatterFieldSchema } from '../../../api.js'
import { useFolderSort } from '../hooks/useFolderSort.js'
import { SortMenu } from './SortMenu.js'

interface Props {
  folderPath: string
  schema: FrontmatterFieldSchema[] | undefined
  x: number
  y: number
  onClose: () => void
}

export function SortMenuWrapper({ folderPath, schema, x, y, onClose }: Props) {
  const { sort, setSort } = useFolderSort(folderPath)
  return (
    <SortMenu
      x={x}
      y={y}
      schema={schema}
      current={sort}
      onChange={setSort}
      onClose={onClose}
    />
  )
}
