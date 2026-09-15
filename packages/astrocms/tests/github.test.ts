import { createServer, type Server } from 'node:http'
import { afterAll, describe, expect, it, vi } from 'vitest'

/**
 * Unit tests for the GitHub client. The API base is read from the environment
 * at call time, so tests point ASTROCMS_GITHUB_API_BASE at a local mock
 * server without any module re-importing.
 */

interface MockGitHub {
  base: string
  /** Recorded bodies of POST /repos/.../pulls calls. */
  createdBodies: any[]
  /** What GET /repos/.../pulls returns (mutable per test). */
  pulls: unknown[]
  /** If set, GET /repos/.../pulls responds with this status. */
  getStatus?: number
}

const servers: Server[] = []

function startMockGitHub(): Promise<MockGitHub> {
  const mock: MockGitHub = { base: '', createdBodies: [], pulls: [] }
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url?.startsWith('/repos/testowner/testrepo/pulls')) {
      const status = mock.getStatus ?? 200
      res.writeHead(status, { 'content-type': 'application/json' })
      if (status === 200) res.end(JSON.stringify(mock.pulls))
      else res.end(JSON.stringify({ message: 'boom' }))
    } else if (req.method === 'POST' && req.url === '/repos/testowner/testrepo/pulls') {
      let raw = ''
      req.on('data', (chunk) => (raw += chunk))
      req.on('end', () => {
        const body = JSON.parse(raw)
        mock.createdBodies.push(body)
        res.writeHead(201, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            number: 7,
            title: body.title,
            html_url: 'https://github.com/testowner/testrepo/pull/7',
          })
        )
      })
    } else {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: 'Not Found' }))
    }
  })
  servers.push(server)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number }
      mock.base = `http://127.0.0.1:${address.port}`
      resolve(mock)
    })
  })
}

afterAll(async () => {
  await Promise.all(
    servers.map((s) => new Promise<void>((r) => s.close(() => r())))
  )
})

describe('parseRepoFromUrl', () => {
  it('parses https URLs with and without the .git suffix', async () => {
    const { parseRepoFromUrl } = await import('../backend/github.js')
    expect(parseRepoFromUrl('https://github.com/owner/repo')).toEqual({
      owner: 'owner',
      repo: 'repo',
    })
    expect(parseRepoFromUrl('https://github.com/owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
    })
  })

  it('strips embedded credentials (as injected by ensureAuthedRemote)', async () => {
    const { parseRepoFromUrl } = await import('../backend/github.js')
    expect(
      parseRepoFromUrl('https://x-access-token:abc123@github.com/owner/repo')
    ).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('parses the ssh shorthand', async () => {
    const { parseRepoFromUrl } = await import('../backend/github.js')
    expect(parseRepoFromUrl('git@github.com:owner/repo.git')).toEqual({
      owner: 'owner',
      repo: 'repo',
    })
  })

  it('rejects non-GitHub URLs and garbage', async () => {
    const { parseRepoFromUrl } = await import('../backend/github.js')
    expect(parseRepoFromUrl('https://gitlab.com/owner/repo')).toBeNull()
    expect(parseRepoFromUrl('/tmp/local/origin.git')).toBeNull()
    expect(parseRepoFromUrl('not a url')).toBeNull()
  })
})

describe('findOpenPr', () => {
  it('returns the first open PR mapped to number/title/url', async () => {
    const mock = await startMockGitHub()
    vi.stubEnv('ASTROCMS_GITHUB_API_BASE', mock.base)
    vi.stubEnv('GIT_PAT', 'test-pat')

    mock.pulls = [
      { number: 7, title: 'My PR', html_url: 'https://github.com/testowner/testrepo/pull/7' },
      { number: 8, title: 'Other', html_url: 'https://github.com/testowner/testrepo/pull/8' },
    ]

    const { findOpenPr } = await import('../backend/github.js')
    const pr = await findOpenPr('testowner', 'testrepo', 'astrocms/test')
    expect(pr).toEqual({
      number: 7,
      title: 'My PR',
      url: 'https://github.com/testowner/testrepo/pull/7',
    })

    vi.unstubAllEnvs()
  })

  it('returns null when no open PR exists', async () => {
    const mock = await startMockGitHub()
    vi.stubEnv('ASTROCMS_GITHUB_API_BASE', mock.base)
    vi.stubEnv('GIT_PAT', 'test-pat')

    const { findOpenPr } = await import('../backend/github.js')
    expect(await findOpenPr('testowner', 'testrepo', 'astrocms/test')).toBeNull()

    vi.unstubAllEnvs()
  })

  it('throws with the API message on failure', async () => {
    const mock = await startMockGitHub()
    vi.stubEnv('ASTROCMS_GITHUB_API_BASE', mock.base)
    vi.stubEnv('GIT_PAT', 'test-pat')

    mock.getStatus = 404

    const { findOpenPr } = await import('../backend/github.js')
    await expect(
      findOpenPr('testowner', 'testrepo', 'astrocms/test')
    ).rejects.toThrow('GitHub API 404: boom')

    vi.unstubAllEnvs()
  })
})

describe('createPullRequest', () => {
  it('posts title, body, head and base and maps the response', async () => {
    const mock = await startMockGitHub()
    vi.stubEnv('ASTROCMS_GITHUB_API_BASE', mock.base)
    vi.stubEnv('GIT_PAT', 'test-pat')

    const { createPullRequest } = await import('../backend/github.js')
    const pr = await createPullRequest('testowner', 'testrepo', {
      title: 'My PR',
      body: '- M index.md\n\n---\nCreated with AstroCMS',
      head: 'astrocms/test',
      base: 'main',
    })

    expect(pr).toEqual({
      number: 7,
      title: 'My PR',
      url: 'https://github.com/testowner/testrepo/pull/7',
    })
    expect(mock.createdBodies).toEqual([
      {
        title: 'My PR',
        body: '- M index.md\n\n---\nCreated with AstroCMS',
        head: 'astrocms/test',
        base: 'main',
      },
    ])

    vi.unstubAllEnvs()
  })

  it('throws with the API message on failure', async () => {
    const mock = await startMockGitHub()
    vi.stubEnv('ASTROCMS_GITHUB_API_BASE', mock.base)
    vi.stubEnv('GIT_PAT', 'test-pat')

    // Point at a path the mock answers with 404.
    const { createPullRequest } = await import('../backend/github.js')
    await expect(
      createPullRequest('testowner', 'missing-repo', {
        title: 't',
        body: 'b',
        head: 'h',
        base: 'main',
      })
    ).rejects.toThrow('GitHub API 404')

    vi.unstubAllEnvs()
  })
})
