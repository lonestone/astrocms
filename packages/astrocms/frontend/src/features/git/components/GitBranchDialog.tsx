import React, { useState } from 'react'
import Button from '../../common/components/Button.js'
import { Dialog } from '../../common/components/Dialog.js'
import { Field, Input } from '../../common/components/Input.js'
import { useGitCreateBranch } from '../hooks/useGit.js'

interface Props {
  baseBranch: string
  onClose: () => void
}

/**
 * Create a new working branch (PR-based edits). The name is free choice; the
 * input ships prefilled with the `astrocms/` prefix as a convenience. The
 * branch always starts from the freshly fetched base (backend).
 */
export function GitBranchDialog({ baseBranch, onClose }: Props) {
  const create = useGitCreateBranch()
  const [name, setName] = useState('astrocms/')

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || create.isPending) return
    create.mutate(trimmed, { onSuccess: () => onClose() })
  }

  return (
    <Dialog
      title="Create a working branch"
      description={`Starts from the latest '${baseBranch}'. Changes you make here are published as a pull request.`}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!name.trim() || create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create branch'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Branch name"
          htmlFor="branch-name"
          hint="Free choice. Invalid names or a dirty working tree are rejected."
        >
          <Input
            id="branch-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
            autoFocus
          />
        </Field>
        {create.error && (
          <div className="text-xs text-danger-text">{create.error.message}</div>
        )}
      </div>
    </Dialog>
  )
}
