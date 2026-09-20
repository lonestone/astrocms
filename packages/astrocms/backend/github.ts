/**
 * Minimal GitHub REST client for PR-based edits. Only the two endpoints the
 * CMS needs: list open pull requests and create one. Auth reuses GIT_PAT.
 *
 * The API base is injectable via ASTROCMS_GITHUB_API_BASE (default:
 * https://api.github.com) so tests can point at a local mock server and
 * GitHub Enterprise users can target their own host.
 */

export interface GitHubPr {
  number: number
  title: string
  url: string
}

function apiBase(): string {
  return process.env.ASTROCMS_GITHUB_API_BASE || 'https://api.github.com'
}

function authHeaders(): Record<string, string> {
  return {
    authorization: `Bearer ${process.env.GIT_PAT ?? ''}`,
    accept: 'application/vnd.github+json',
    'user-agent': 'astrocms',
  }
}

/**
 * Extract { owner, repo } from a GitHub remote URL. Accepts the https form
 * (with or without embedded credentials and .git suffix) and the ssh
 * shorthand. Returns null for anything else (other forges are out of scope).
 */
export function parseRepoFromUrl(
  url: string
): { owner: string; repo: string } | null {
  let normalized = url.trim()
  const ssh = normalized.match(/^git@github\.com:(.+)$/)
  if (ssh) normalized = `https://github.com/${ssh[1]}`
  const m = normalized.match(
    /^https?:\/\/(?:[^@/]+@)?github\.com\/([^/]+)\/([^/?#]+)/i
  )
  if (!m) return null
  const repo = m[2].replace(/\.git$/, '')
  if (!m[1] || !repo) return null
  return { owner: m[1], repo }
}

function mapPr(raw: any): GitHubPr {
  return { number: raw.number, title: raw.title, url: raw.html_url }
}

async function githubError(res: Response): Promise<never> {
  let message = `GitHub API ${res.status}`
  try {
    const data: any = await res.json()
    if (data?.message) message += `: ${data.message}`
  } catch {
    // Non-JSON error body; the status code alone is still useful.
  }
  throw new Error(message)
}

/** The open PR for `owner:head`, or null when there is none. */
export async function findOpenPr(
  owner: string,
  repo: string,
  head: string
): Promise<GitHubPr | null> {
  const url = `${apiBase()}/repos/${owner}/${repo}/pulls?state=open&head=${encodeURIComponent(
    `${owner}:${head}`
  )}`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) return githubError(res)
  const data = (await res.json()) as any[]
  return Array.isArray(data) && data.length ? mapPr(data[0]) : null
}

export async function createPullRequest(
  owner: string,
  repo: string,
  input: { title: string; body: string; head: string; base: string }
): Promise<GitHubPr> {
  const res = await fetch(`${apiBase()}/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      head: input.head,
      base: input.base,
    }),
  })
  if (!res.ok) return githubError(res)
  return mapPr((await res.json()) as any)
}
