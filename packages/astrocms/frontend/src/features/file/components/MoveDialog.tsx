import React, { useMemo, useState } from 'react'
import type { TreeNode } from '../../../api.js'
import Button from '../../common/components/Button.js'
import { Dialog } from '../../common/components/Dialog.js'
import { Field, inputClass } from '../../common/components/Input.js'
import { parentOf } from '../../common/utils/paths.js'
import { useFiles } from '../contexts/FilesContext.js'

interface Props {
  node: TreeNode
  onCancel: () => void
  onConfirm: (destFolder: string) => void | Promise<void>
}

function collectFolders(
  nodes: TreeNode[],
  exclude: (path: string) => boolean
): string[] {
  const out: string[] = []
  function walk(list: TreeNode[]) {
    for (const n of list) {
      if (n.type !== 'directory') continue
      if (exclude(n.path)) continue
      out.push(n.path)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

export function MoveDialog({ node, onCancel, onConfirm }: Props) {
  const { tree } = useFiles()
  const currentParent = parentOf(node.path)

  const folders = useMemo(() => {
    const isSelfOrDescendant = (path: string) =>
      node.type === 'directory' &&
      (path === node.path || path.startsWith(node.path + '/'))
    return ['', ...collectFolders(tree, isSelfOrDescendant)]
  }, [tree, node])

  const [value, setValue] = useState(currentParent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (value === currentParent) {
      onCancel()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onConfirm(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      title={`Move ${node.name}`}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={busy || value === currentParent}
          >
            {busy ? 'Moving' : 'Move'}
          </Button>
        </>
      }
    >
      <Field label="Destination folder" htmlFor="move-dest" error={error}>
        <select
          id="move-dest"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleSubmit()
            }
          }}
          className={`${inputClass} font-mono text-xs`}
        >
          {folders.map((f) => (
            <option key={f} value={f}>
              {f === '' ? '/' : f}
            </option>
          ))}
        </select>
      </Field>
    </Dialog>
  )
}
