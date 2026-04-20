import React from 'react'
import { MediaModalProvider } from './features/file/components/MediaModal.js'
import { FilesProvider } from './features/file/contexts/FilesContext.js'
import { Layout } from './features/common/components/Layout.js'
import { AuthGate } from './features/auth/components/AuthGate.js'

export function App() {
  return (
    <AuthGate>
      <FilesProvider>
        <MediaModalProvider>
          <Layout />
        </MediaModalProvider>
      </FilesProvider>
    </AuthGate>
  )
}
