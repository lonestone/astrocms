import React from 'react'
import { Menu, MenuItem } from '../../common/components/Menu.js'

export interface ActionItem {
  label: string
  onClick: () => void
  danger?: boolean
  icon?: React.ReactNode
}

interface Props {
  items: ActionItem[]
  x: number
  y: number
  onClose: () => void
}

export function ActionsMenu({ items, x, y, onClose }: Props) {
  return (
    <Menu
      x={x}
      y={y}
      width={184}
      estimatedHeight={items.length * 30 + 8}
      onClose={onClose}
    >
      {items.map((item, i) => (
        <MenuItem
          key={i}
          icon={item.icon}
          danger={item.danger}
          onClick={() => {
            item.onClick()
            onClose()
          }}
        >
          {item.label}
        </MenuItem>
      ))}
    </Menu>
  )
}
