import React from 'react'
import { Routes, Route } from 'react-router'
import { Editor } from '../../editor/components/Editor.js'
import { Placeholder } from './Placeholder.js'

interface Props {
  filePath: string | null
  onSelectFile: (path: string) => void
}

export function AppRoutes({ filePath, onSelectFile }: Props) {
  return (
    <Routes>
      <Route path="/" element={<Placeholder />} />
      <Route
        path="/edit/*"
        element={<Editor key={filePath} onSelectFile={onSelectFile} />}
      />
    </Routes>
  )
}
