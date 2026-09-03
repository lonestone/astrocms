import React from 'react'
import { TbFileText } from 'react-icons/tb'

export function Placeholder() {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="flex max-w-xs flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-panel border border-border bg-surface-raised text-text-muted">
          <TbFileText size={22} />
        </div>
        <h2 className="text-base font-semibold text-text">No file open</h2>
        <p className="mt-1 text-ui text-text-muted">
          Pick a page in the sidebar, or ask the agent to create one from the
          prompt above.
        </p>
      </div>
    </div>
  )
}
