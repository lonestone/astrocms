import React, { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Sidebar } from '../../sidebar/components/Sidebar.js'
import { AgentPanel } from '../../agent/components/AgentPanel.js'
import { AgentRuntimeProvider } from '../../agent/contexts/AgentRuntimeContext.js'
import { FilePathProvider } from '../../editor/contexts/FilePathContext.js'
import { CurrentLangProvider } from '../contexts/CurrentLangContext.js'
import { Header } from './Header.js'
import { AppRoutes } from './AppRoutes.js'
import { usePanelToggles } from '../hooks/usePanelToggles.js'
import { useCurrentFilePath } from '../hooks/useCurrentFilePath.js'
import { useGitRemoteSync } from '../../git/hooks/useGit.js'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const filePath = useCurrentFilePath()
  const { agentOpen, setAgentOpen, toggleAgent } = usePanelToggles()
  useGitRemoteSync()

  const openAgent = useCallback(() => setAgentOpen(true), [setAgentOpen])

  function handleSelectFile(path: string) {
    navigate(`/edit/${path}`)
  }

  const isGitRoute = location.pathname.startsWith('/git')
  const mainClass = isGitRoute
    ? 'flex-1 overflow-hidden bg-bg-main flex flex-col'
    : 'flex-1 overflow-auto p-4 bg-bg-main'

  return (
    <AgentRuntimeProvider onRequestOpen={openAgent}>
      <CurrentLangProvider filePath={filePath}>
        <FilePathProvider filePath={filePath}>
          <Header
            agentOpen={agentOpen}
            onToggleAgent={toggleAgent}
            onNavigateGit={() => navigate('/git')}
          />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar onSelectFile={handleSelectFile} />
            <main className={mainClass}>
              <AppRoutes
                filePath={filePath}
                onSelectFile={handleSelectFile}
              />
            </main>
            <AgentPanel open={agentOpen} />
          </div>
        </FilePathProvider>
      </CurrentLangProvider>
    </AgentRuntimeProvider>
  )
}
