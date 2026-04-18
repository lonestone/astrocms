const BASE = '/astrocms/api'

const AUTH_EVENT = 'astrocms-auth-required'

export function onAuthRequired(listener: () => void): () => void {
  window.addEventListener(AUTH_EVENT, listener)
  return () => window.removeEventListener(AUTH_EVENT, listener)
}

async function authFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, init)
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_EVENT))
  }
  return res
}

export interface AuthStatus {
  required: boolean
  authenticated: boolean
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await authFetch(`/auth/status`)
  return res.json()
}

export async function login(
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await authFetch(`/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data?.error ?? 'Login failed' }
  }
  return { ok: true }
}

export async function logout(): Promise<void> {
  await authFetch('/auth/logout', { method: 'POST' })
}

export interface PublicConfig {
  devServer: boolean
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  const res = await authFetch(`/config`)
  return res.json()
}

export interface TreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

export interface GitFile {
  status: string
  staged: boolean
  path: string
}

export async function fetchTree(): Promise<TreeNode[]> {
  const res = await authFetch(`/tree`)
  return res.json()
}

export interface FrontmatterFieldSchema extends Omit<PropSchema, 'itemSchema'> {
  required?: boolean
  children?: FrontmatterFieldSchema[]
  itemSchema?: FrontmatterFieldSchema[]
}

export interface FileResponse {
  path: string
  content: string
  frontmatterSchema?: FrontmatterFieldSchema[]
  schemaError?: string
}

export async function fetchFile(path: string): Promise<FileResponse> {
  const res = await authFetch(`/file?path=${encodeURIComponent(path)}`)
  if (!res.ok) throw new Error(`File not found: ${path}`)
  return res.json()
}

export async function saveFile(
  path: string,
  content: string
): Promise<{ ok: boolean }> {
  const res = await authFetch(`/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  return res.json()
}

export async function fetchGitStatus(): Promise<{ files: GitFile[] }> {
  const res = await authFetch(`/git/status`)
  return res.json()
}

export async function fetchGitDiff(path?: string): Promise<{ diff: string }> {
  const url = path
    ? `/git/diff?path=${encodeURIComponent(path)}`
    : `/git/diff`
  const res = await authFetch(url)
  return res.json()
}

export async function gitCommit(
  message: string,
  push = false
): Promise<{ ok: boolean; commit?: string; error?: string }> {
  const res = await authFetch(`/git/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, push }),
  })
  return res.json()
}

export async function gitStage(paths: string[]): Promise<{ ok: boolean }> {
  const res = await authFetch(`/git/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  })
  return res.json()
}

export async function gitUnstage(paths: string[]): Promise<{ ok: boolean }> {
  const res = await authFetch(`/git/unstage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  })
  return res.json()
}

export async function gitDiscard(path: string): Promise<{ ok: boolean }> {
  const res = await authFetch(`/git/discard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  return res.json()
}

// Claude agent

export interface ClaudeStatus {
  authenticated: boolean
  error?: string
  account?: { email?: string; organization?: string }
}

export async function fetchClaudeStatus(
  force = false
): Promise<ClaudeStatus> {
  const url = force
    ? `/claude/status?force=true`
    : `/claude/status`
  const res = await authFetch(url)
  return res.json()
}

export interface LoginResult {
  manualUrl?: string
  automaticUrl?: string
  error?: string
}

export async function startClaudeLogin(): Promise<LoginResult> {
  const res = await authFetch(`/claude/login`, { method: 'POST' })
  return res.json()
}

export interface LoginCodeResult {
  account?: ClaudeStatus['account']
  error?: string
}

export async function submitClaudeLoginCode(
  code: string,
  state: string
): Promise<LoginCodeResult> {
  const res = await authFetch(`/claude/login/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, state }),
  })
  return res.json()
}

export interface Conversation {
  id: string
  summary: string
  firstPrompt?: string
  lastModified: number
  customTitle?: string
}

export async function fetchConversations(
  limit = 20
): Promise<Conversation[]> {
  const res = await authFetch(`/claude/conversations?limit=${limit}`)
  return res.json()
}

export async function fetchConversationMessages(
  id: string
): Promise<any[]> {
  const res = await authFetch(`/claude/conversations/${id}/messages`)
  return res.json()
}

// Claude permissions

export interface PendingPermission {
  pending: true
  id: string
  toolName: string
  input: Record<string, unknown>
  title?: string
  decisionReason?: string
}

export async function respondToPermission(
  id: string,
  behavior: 'allow' | 'deny',
  message?: string
): Promise<{ ok: boolean }> {
  const res = await authFetch(`/claude/permissions/${id}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ behavior, message }),
  })
  return res.json()
}

export interface PropSchema {
  name: string
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'json'
    | 'image'
    | 'date'
    | 'string-array'
    | 'object'
  optional?: boolean
  options?: string[]
  itemSchema?: PropSchema[]
}

export interface ComponentDescriptor {
  name: string
  props: PropSchema[]
  slots: string[]
}

export async function fetchComponents(): Promise<ComponentDescriptor[]> {
  const res = await authFetch(`/components`)
  return res.json()
}

export async function uploadMedia(
  file: File,
  targetDir: string
): Promise<{ ok: boolean; path: string; name: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('targetDir', targetDir)
  const res = await authFetch(`/upload`, {
    method: 'POST',
    body: formData,
  })
  return res.json()
}
