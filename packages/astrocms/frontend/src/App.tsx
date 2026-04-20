import React from 'react'
import { MediaModalProvider } from './features/file/components/MediaModal.js'
import { Layout } from './features/common/components/Layout.js'
import { AuthGate } from './features/auth/components/AuthGate.js'

export function App() {
  return (
    <AuthGate>
      <MediaModalProvider>
        <Layout />
      </MediaModalProvider>
    </AuthGate>
  )
}
