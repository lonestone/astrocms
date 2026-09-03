import React from 'react'
import { TbMoon, TbSun } from 'react-icons/tb'
import { useTheme } from '../hooks/useTheme.js'
import { IconButton } from './IconButton.js'

export function ThemeToggle() {
  const { isDark, toggle } = useTheme()
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <IconButton label={label} onClick={toggle}>
      {isDark ? <TbSun size={18} /> : <TbMoon size={18} />}
    </IconButton>
  )
}
