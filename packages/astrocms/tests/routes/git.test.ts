import { execFile } from 'child_process'
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Integration tests for the git routes in PR-based edits mode. Each test
 * builds a real (temporary) site repo with a bare local remote as origin, so
 * branch guards and ahead/behind detection run against actual git without any
 * network access.
 *
 * `ROOT_DIR` is resolved from ASTROCMS_ROOT at module import time and both it
 * and the config cache are per module instance, so each test points the env
 * var at its own fixture root and re-imports the routes via vi.resetModules().
 */

const exec = promisify(execFile)

async function git(cwd: string, ...args: string[]) {
  const { stdout } = await exec('git', args, { cwd })
  return stdout.trimEnd()
}

interface Fixture {
  dir: string // temp parent holding site + origin.git
  root: string // the site working copy (ASTROCMS_ROOT)
  origin: string // bare remote
}

async function makeFixture(
  gitConfig: Record<string, unknown> | null
): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), 'astrocms-git-'))
  const root = join(dir, 'site')
  const origin = join(dir, 'origin.git')
  await mkdir(root)

  await git(dir, 'init', '--bare', origin)
  await git(root, 'init', '-b', 'main')
  await git(root, 'config', 'user.email', 'cms@test.local')
  await git(root, 'config', 'user.name', 'CMS Test')

  await writeFile(join(root, 'index.md'), '# Hello\n')
  await git(root, 'add', '.')
  await git(root, 'commit', '-m', 'initial')

  if (gitConfig) {
    await writeFile(join(root, 'astrocms.json'), JSON.stringify(gitConfig))
    await git(root, 'add', '.')
    await git(root, 'commit', '-m', 'config')
  }

  await git(root, 'remote', 'add', 'origin', origin)
  await git(root, 'push', '-u', 'origin', 'main')
  // Point the bare repo's HEAD at main so clones check out a branch.
  await git(dir, '--git-dir', origin, 'symbolic-ref', 'HEAD', 'refs/heads/main')

  return { dir, root, origin }
}

/**
 * Advance a branch on origin through a second clone, simulating someone else
 * pushing to the repo.
 */
async function advanceOrigin(
  fx: Fixture,
  branch: string,
  file: string,
  content: string,
  message: string
): Promise<void> {
  const other = join(fx.dir, 'other')
  await git(fx.dir, 'clone', fx.origin, other)
  if (branch !== 'main') await git(other, 'switch', branch)
  await git(other, 'config', 'user.email', 'other@test.local')
  await git(other, 'config', 'user.name', 'Other')
  await writeFile(join(other, file), content)
  await git(other, 'add', '.')
  await git(other, 'commit', '-m', message)
  await git(other, 'push', 'origin', branch)
}

type Routes = { request(path: string, init?: RequestInit): Promise<Response> }

let lastApp: Routes | undefined
const createdDirs: string[] = []

async function importRoutes(root: string): Promise<Routes> {
  vi.stubEnv('ASTROCMS_ROOT', root)
  vi.resetModules()
  const { gitRoutes } = await import('../../backend/routes/git.js')
  lastApp = gitRoutes
  return gitRoutes
}

/**
 * Wait until the fire-and-forget remote check of a module instance has run.
 * The check is throttled per module instance, so tests that need a second
 * check re-import the routes for a fresh instance.
 */
async function settle(app: Routes): Promise<void> {
  const deadline = Date.now() + 5000
  for (;;) {
    const res = await app.request('/remote-status')
    const body: any = await res.json()
    if (body.lastCheckedAt !== null) return
    if (Date.now() > deadline) {
      throw new Error(`remote check did not complete: ${body.error ?? 'timeout'}`)
    }
    await new Promise((r) => setTimeout(r, 50))
  }
}

function post(app: Routes, path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  // Keep the suite hermetic against a developer's own environment: without
  // these stubs an ambient GIT_PAT/GIT_REPO_URL would rewrite the fixture's
  // origin URL to a remote that does not exist.
  vi.stubEnv('GIT_PAT', '')
  vi.stubEnv('GIT_REPO_URL', '')
  vi.stubEnv('GIT_BRANCH', '')
})

afterEach(async () => {
  // Let any in-flight remote check finish before the fixture is deleted.
  if (lastApp) await settle(lastApp).catch(() => {})
  lastApp = undefined
  vi.unstubAllEnvs()
  vi.resetModules()
})

afterAll(async () => {
  await Promise.all(createdDirs.map((d) => rm(d, { recursive: true, force: true })))
})

describe('git routes in PR-based edits mode', () => {
  it('blocks commits on the base branch', async () => {
    const fx = await makeFixture({ git: { prBasedEdits: true } })
    createdDirs.push(fx.dir)
    const app = await importRoutes(fx.root)

    await writeFile(join(fx.root, 'index.md'), '# Changed\n')
    await git(fx.root, 'add', '.')

    const res = await post(app, '/commit', { message: 'nope' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('working branch')

    // Nothing was committed.
    expect(await git(fx.root, 'rev-list', '--count', 'HEAD')).toBe('2')
  })

  it('allows commits on a working branch', async () => {
    const fx = await makeFixture({ git: { prBasedEdits: true } })
    createdDirs.push(fx.dir)
    const app = await importRoutes(fx.root)

    await git(fx.root, 'switch', '-c', 'astrocms/test')
    await writeFile(join(fx.root, 'index.md'), '# Changed\n')
    await git(fx.root, 'add', '.')

    const res = await post(app, '/commit', { message: 'edit' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    expect(await git(fx.root, 'rev-list', '--count', 'HEAD')).toBe('3')
  })

  it('pushes the working branch when committing with push', async () => {
    const fx = await makeFixture({ git: { prBasedEdits: true } })
    createdDirs.push(fx.dir)
    const app = await importRoutes(fx.root)

    await git(fx.root, 'switch', '-c', 'astrocms/test')
    await writeFile(join(fx.root, 'index.md'), '# Changed\n')
    await git(fx.root, 'add', '.')

    const res = await post(app, '/commit', { message: 'edit', push: true })
    expect(res.status).toBe(200)

    const refs = await git(fx.root, 'ls-remote', 'origin', 'astrocms/test')
    expect(refs).toContain('refs/heads/astrocms/test')
  })

  it('keeps committing on main in non-PR mode', async () => {
    const fx = await makeFixture({ git: { prBasedEdits: false } })
    createdDirs.push(fx.dir)
    const app = await importRoutes(fx.root)

    await writeFile(join(fx.root, 'index.md'), '# Changed\n')
    await git(fx.root, 'add', '.')

    const res = await post(app, '/commit', { message: 'edit' })
    expect(res.status).toBe(200)

    expect(await git(fx.root, 'rev-list', '--count', 'HEAD')).toBe('3')
  })

  it('exposes the branch object in /status with PR mode on', async () => {
    const fx = await makeFixture({ git: { prBasedEdits: true } })
    createdDirs.push(fx.dir)
    const app = await importRoutes(fx.root)

    await settle(app)
    let body: any = await (await app.request('/status')).json()
    expect(body.branch).toEqual({
      prMode: true,
      currentBranch: 'main',
      baseBranch: 'main',
      onBaseBranch: true,
      aheadOfBase: 0,
      behindBase: 0,
      openPr: null,
    })

    await git(fx.root, 'switch', '-c', 'astrocms/test')
    body = await (await app.request('/status')).json()
    expect(body.branch.currentBranch).toBe('astrocms/test')
    expect(body.branch.onBaseBranch).toBe(false)
  })

  it('omits the branch object in /status without PR mode', async () => {
    const fx = await makeFixture(null)
    createdDirs.push(fx.dir)
    const app = await importRoutes(fx.root)

    await settle(app)
    const body: any = await (await app.request('/status')).json()
    expect(body.branch).toBeUndefined()
  })

  it('tracks ahead/behind against the base branch', async () => {
    const fx = await makeFixture({ git: { prBasedEdits: true } })
    createdDirs.push(fx.dir)

    // One commit ahead of main on a working branch.
    await git(fx.root, 'switch', '-c', 'astrocms/test')
    await writeFile(join(fx.root, 'index.md'), '# v2\n')
    await git(fx.root, 'add', '.')
    await git(fx.root, 'commit', '-m', 'ahead')

    let app = await importRoutes(fx.root)
    await settle(app)
    let body: any = await (await app.request('/status')).json()
    expect(body.branch.aheadOfBase).toBe(1)
    expect(body.branch.behindBase).toBe(0)

    // Advance origin/main through a second clone.
    const other = join(fx.dir, 'other')
    await git(fx.dir, 'clone', fx.origin, other)
    await git(other, 'config', 'user.email', 'other@test.local')
    await git(other, 'config', 'user.name', 'Other')
    await writeFile(join(other, 'index.md'), '# from main\n')
    await git(other, 'add', '.')
    await git(other, 'commit', '-m', 'main moves')
    await git(other, 'push', 'origin', 'main')

    // Fresh module instance: the remote check is throttled per instance.
    app = await importRoutes(fx.root)
    await settle(app)
    body = await (await app.request('/status')).json()
    expect(body.branch.aheadOfBase).toBe(1)
    expect(body.branch.behindBase).toBe(1)
  })

  it('refuses to pull the base branch in PR mode', async () => {
    const fx = await makeFixture({ git: { prBasedEdits: true } })
    createdDirs.push(fx.dir)
    const app = await importRoutes(fx.root)

    const res = await post(app, '/pull', {})
    expect(res.status).toBe(400)
  })

  it('ASTROCMS_PR_BASED_EDITS=1 enables the guards without a config file', async () => {
    const fx = await makeFixture(null)
    createdDirs.push(fx.dir)

    vi.stubEnv('ASTROCMS_PR_BASED_EDITS', '1')
    const app = await importRoutes(fx.root)

    await writeFile(join(fx.root, 'index.md'), '# Changed\n')
    await git(fx.root, 'add', '.')

    const res = await post(app, '/commit', { message: 'nope' })
    expect(res.status).toBe(400)

    const status: any = await (await app.request('/status')).json()
    expect(status.branch.prMode).toBe(true)
  })
})

describe('git routes (existing behavior)', () => {
  it('auto ff-pulls the configured branch when behind and clean', async () => {
    const fx = await makeFixture(null)
    createdDirs.push(fx.dir)

    await advanceOrigin(fx, 'main', 'index.md', '# from remote\n', 'remote edit')

    const app = await importRoutes(fx.root)
    await settle(app)
    const remote: any = await (await app.request('/remote-status')).json()

    expect(remote.updateAvailable).toBe(false)
    expect(remote.behind).toBe(0)
    expect(remote.lastPulledAt).not.toBeNull()

    // The site worktree now contains the remote commit.
    expect(await readFile(join(fx.root, 'index.md'), 'utf-8')).toBe(
      '# from remote\n'
    )
  })

  it('flags an available update without pulling when the worktree is dirty', async () => {
    const fx = await makeFixture(null)
    createdDirs.push(fx.dir)

    await advanceOrigin(fx, 'main', 'index.md', '# from remote\n', 'remote edit')
    await writeFile(join(fx.root, 'index.md'), '# local dirty\n')

    const app = await importRoutes(fx.root)
    await settle(app)
    const remote: any = await (await app.request('/remote-status')).json()

    expect(remote.updateAvailable).toBe(true)
    expect(remote.behind).toBe(1)
    expect(remote.lastPulledAt).toBeNull()

    // Nothing was pulled.
    expect(await readFile(join(fx.root, 'index.md'), 'utf-8')).toBe(
      '# local dirty\n'
    )
  })

  it('/pull pulls the branch from GIT_BRANCH', async () => {
    const fx = await makeFixture(null)
    createdDirs.push(fx.dir)

    // A release branch on origin, checked out in the site.
    await git(fx.root, 'switch', '-c', 'release')
    await git(fx.root, 'push', '-u', 'origin', 'release')

    await advanceOrigin(fx, 'release', 'index.md', '# release update\n', 'release edit')

    vi.stubEnv('GIT_BRANCH', 'release')
    const app = await importRoutes(fx.root)

    const res = await post(app, '/pull', {})
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    expect(await readFile(join(fx.root, 'index.md'), 'utf-8')).toBe(
      '# release update\n'
    )
  })

  it('/commit with push pushes the branch from GIT_BRANCH', async () => {
    const fx = await makeFixture(null)
    createdDirs.push(fx.dir)

    await git(fx.root, 'switch', '-c', 'release')
    await git(fx.root, 'push', '-u', 'origin', 'release')

    vi.stubEnv('GIT_BRANCH', 'release')
    const app = await importRoutes(fx.root)

    await writeFile(join(fx.root, 'index.md'), '# local edit\n')
    await git(fx.root, 'add', '.')

    const res = await post(app, '/commit', { message: 'edit', push: true })
    expect(res.status).toBe(200)

    const head = await git(fx.root, 'rev-parse', 'HEAD')
    const refs = await git(fx.root, 'ls-remote', 'origin', 'release')
    expect(refs.split('\t')[0]).toBe(head)
  })

  it('auto ff-pulls a working branch behind its own remote in PR mode', async () => {
    const fx = await makeFixture({ git: { prBasedEdits: true } })
    createdDirs.push(fx.dir)

    await git(fx.root, 'switch', '-c', 'astrocms/test')
    await writeFile(join(fx.root, 'index.md'), '# v2\n')
    await git(fx.root, 'add', '.')
    await git(fx.root, 'commit', '-m', 'first')
    await git(fx.root, 'push', '-u', 'origin', 'astrocms/test')

    await advanceOrigin(fx, 'astrocms/test', 'index.md', '# v3\n', 'remote edit')

    const app = await importRoutes(fx.root)
    await settle(app)
    const remote: any = await (await app.request('/remote-status')).json()

    expect(remote.updateAvailable).toBe(false)
    expect(remote.behind).toBe(0)
    expect(remote.lastPulledAt).not.toBeNull()

    expect(await readFile(join(fx.root, 'index.md'), 'utf-8')).toBe('# v3\n')
  })

  it('/stage and /unstage toggle the staged flag', async () => {
    const fx = await makeFixture(null)
    createdDirs.push(fx.dir)
    const app = await importRoutes(fx.root)

    // Tracked modification.
    await writeFile(join(fx.root, 'index.md'), '# Changed\n')
    let body: any = await (await app.request('/status')).json()
    expect(body.files.find((f: any) => f.path === 'index.md')).toEqual({
      status: 'M',
      staged: false,
      path: 'index.md',
    })

    expect((await post(app, '/stage', { paths: ['index.md'] })).status).toBe(200)
    body = await (await app.request('/status')).json()
    expect(body.files.find((f: any) => f.path === 'index.md')?.staged).toBe(true)

    expect((await post(app, '/unstage', { paths: ['index.md'] })).status).toBe(200)
    body = await (await app.request('/status')).json()
    expect(body.files.find((f: any) => f.path === 'index.md')?.staged).toBe(false)

    // Untracked file.
    await writeFile(join(fx.root, 'new.txt'), 'hello\n')
    body = await (await app.request('/status')).json()
    expect(body.files.find((f: any) => f.path === 'new.txt')?.staged).toBe(false)

    expect((await post(app, '/stage', { paths: ['new.txt'] })).status).toBe(200)
    body = await (await app.request('/status')).json()
    expect(body.files.find((f: any) => f.path === 'new.txt')?.staged).toBe(true)
  })

  it('/diffs returns per-file diffs including untracked files', async () => {
    const fx = await makeFixture(null)
    createdDirs.push(fx.dir)
    const app = await importRoutes(fx.root)

    await writeFile(join(fx.root, 'index.md'), '# Changed\n')
    await writeFile(join(fx.root, 'new.txt'), 'hello world\n')

    const body: any = await (await app.request('/diffs')).json()

    expect(Object.keys(body.diffs).sort()).toEqual(['index.md', 'new.txt'])
    expect(body.diffs['index.md']).toContain('-# Hello')
    expect(body.diffs['index.md']).toContain('+# Changed')
    // Untracked files are synthesized as added-file diffs.
    expect(body.diffs['new.txt']).toContain('+hello world')
  })

  it('/discard restores tracked files and deletes untracked ones', async () => {
    const fx = await makeFixture(null)
    createdDirs.push(fx.dir)
    const app = await importRoutes(fx.root)

    // Tracked modification is restored.
    await writeFile(join(fx.root, 'index.md'), '# Changed\n')
    expect((await post(app, '/discard', { path: 'index.md' })).status).toBe(200)
    expect(await readFile(join(fx.root, 'index.md'), 'utf-8')).toBe('# Hello\n')

    // Untracked file is deleted.
    await writeFile(join(fx.root, 'new.txt'), 'hello\n')
    expect((await post(app, '/discard', { path: 'new.txt' })).status).toBe(200)
    await expect(access(join(fx.root, 'new.txt'))).rejects.toThrow()

    // Path traversal is rejected.
    expect((await post(app, '/discard', { path: '../outside.txt' })).status).toBe(400)
  })
})
