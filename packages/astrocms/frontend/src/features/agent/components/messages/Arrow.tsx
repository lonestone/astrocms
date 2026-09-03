import React from 'react'
import { TbChevronRight } from 'react-icons/tb'

interface Props {
  open: boolean
}

export function Arrow({ open }: Props) {
  return (
    <TbChevronRight
      size={14}
      className={`shrink-0 transition-transform duration-150 ${
        open ? 'rotate-90' : ''
      }`}
    />
  )
}
