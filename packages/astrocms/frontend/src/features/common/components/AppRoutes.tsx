import React from 'react'
import { Routes, Route } from 'react-router'
import { Editor } from '../../editor/components/Editor.js'
import { GitReview } from '../../git/components/GitReview.js'
import { Placeholder } from './Placeholder.js'

interface Props {
  filePath: string | null
  onSelectFile: (path: string) => void
}

export function AppRoutes({ filePath, onSelectFile }: Props) {
  return (
    <Routes>
      <Route path="/" element={<Placeholder />} />
      <Route path="/git" element={<GitReview />} />
      <Route
        path="/edit/*"
        element={<Editor key={filePath} onSelectFile={onSelectFile} />}
      />
    </Routes>
  )
}
