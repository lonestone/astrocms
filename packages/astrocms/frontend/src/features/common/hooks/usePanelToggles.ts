import { usePersistedPanel } from './usePersistedPanel.js'

export function usePanelToggles() {
  const [agentOpen, setAgentOpen] = usePersistedPanel('cms-agent-panel-open')

  function toggleAgent() {
    setAgentOpen(!agentOpen)
  }

  return { agentOpen, setAgentOpen, toggleAgent }
}
