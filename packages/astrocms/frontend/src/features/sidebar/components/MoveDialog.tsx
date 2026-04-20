import React, { useMemo, useState } from 'react'
import type { TreeNode } from '../../../api.js'
import Button from '../../common/components/Button.js'

interface Props {
  node: TreeNode
  tree: TreeNode[]
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

export function MoveDialog({ node, tree, onCancel, onConfirm }: Props) {
  const currentParent = node.path.includes('/')
    ? node.path.slice(0, node.path.lastIndexOf('/'))
    : ''

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
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="bg-white rounded-lg w-full max-w-sm p-5 shadow-2xl">
        <h3 className="mb-3 text-sm font-semibold">Move {node.name}</h3>
        <label className="block mb-4 text-xs text-gray-500">
          Destination folder
          <select
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSubmit()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                onCancel()
              }
            }}
            className="block w-full mt-1 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono bg-white"
          >
            {folders.map((f) => (
              <option key={f} value={f}>
                {f === '' ? '/' : f}
              </option>
            ))}
          </select>
        </label>
        {error && <div className="mb-3 text-xs text-danger">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={busy || value === currentParent}
          >
            {busy ? '...' : 'Move'}
          </Button>
        </div>
      </div>
    </div>
  )
}
