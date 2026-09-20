import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tests for the `git` block of astrocms.json (PR-based edits flag and base
 * branch) as resolved by loadConfig().
 *
 * `ROOT_DIR` is resolved from ASTROCMS_ROOT at module import time and
 * `loadConfig()` caches per module instance, so each test points the env var
 * at its own fixture root and re-imports the module via vi.resetModules().
 */

async function makeRoot(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'astrocms-config-'))
  for (const [rel, content] of Object.entries(files)) {
    await writeFile(join(root, rel), content, 'utf-8')
  }
  return root
}

async function loadConfigIn(root: string) {
  vi.stubEnv('ASTROCMS_ROOT', root)
  vi.resetModules()
  const { loadConfig } = await import('../backend/config.js')
  return loadConfig()
}

const createdRoots: string[] = []

beforeEach(() => {
  // Keep the suite hermetic against a developer's own environment.
  vi.stubEnv('ASTROCMS_PR_BASED_EDITS', '')
  vi.stubEnv('GIT_BRANCH', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

afterAll(async () => {
  await Promise.all(createdRoots.map((r) => rm(r, { recursive: true, force: true })))
})

describe('loadConfig git block', () => {
  it('defaults to PR mode off and base branch main without a config file', async () => {
    const root = await makeRoot({})
    createdRoots.push(root)

    const config = await loadConfigIn(root)

    expect(config.git.prBasedEdits).toBe(false)
    expect(config.git.baseBranch).toBe('main')
  })

  it('reads the git block from astrocms.json', async () => {
    const root = await makeRoot({
      'astrocms.json': JSON.stringify({ git: { prBasedEdits: true } }),
    })
    createdRoots.push(root)

    const config = await loadConfigIn(root)

    expect(config.git.prBasedEdits).toBe(true)
    expect(config.git.baseBranch).toBe('main')
  })

  it('reads a custom base branch from astrocms.json', async () => {
    const root = await makeRoot({
      'astrocms.json': JSON.stringify({
        git: { prBasedEdits: true, baseBranch: 'develop' },
      }),
    })
    createdRoots.push(root)

    const config = await loadConfigIn(root)

    expect(config.git.baseBranch).toBe('develop')
  })

  it('ASTROCMS_PR_BASED_EDITS=1 turns the feature on without a config file', async () => {
    const root = await makeRoot({})
    createdRoots.push(root)

    vi.stubEnv('ASTROCMS_PR_BASED_EDITS', '1')
    const config = await loadConfigIn(root)

    expect(config.git.prBasedEdits).toBe(true)
  })

  it('ASTROCMS_PR_BASED_EDITS accepts true/false case-insensitively', async () => {
    const root = await makeRoot({})
    createdRoots.push(root)

    vi.stubEnv('ASTROCMS_PR_BASED_EDITS', 'TRUE')
    let config = await loadConfigIn(root)
    expect(config.git.prBasedEdits).toBe(true)

    vi.stubEnv('ASTROCMS_PR_BASED_EDITS', 'false')
    config = await loadConfigIn(root)
    expect(config.git.prBasedEdits).toBe(false)
  })

  it('the env var overrides the file value in both directions', async () => {
    const root = await makeRoot({
      'astrocms.json': JSON.stringify({ git: { prBasedEdits: true } }),
    })
    createdRoots.push(root)

    vi.stubEnv('ASTROCMS_PR_BASED_EDITS', '0')
    let config = await loadConfigIn(root)
    expect(config.git.prBasedEdits).toBe(false)

    const rootOff = await makeRoot({
      'astrocms.json': JSON.stringify({ git: { prBasedEdits: false } }),
    })
    createdRoots.push(rootOff)

    vi.stubEnv('ASTROCMS_PR_BASED_EDITS', '1')
    config = await loadConfigIn(rootOff)
    expect(config.git.prBasedEdits).toBe(true)
  })

  it('falls back to GIT_BRANCH for the base branch when the file has none', async () => {
    const root = await makeRoot({})
    createdRoots.push(root)

    vi.stubEnv('GIT_BRANCH', 'trunk')
    const config = await loadConfigIn(root)

    expect(config.git.baseBranch).toBe('trunk')
  })

  it('an explicit baseBranch in the file wins over GIT_BRANCH', async () => {
    const root = await makeRoot({
      'astrocms.json': JSON.stringify({ git: { baseBranch: 'develop' } }),
    })
    createdRoots.push(root)

    vi.stubEnv('GIT_BRANCH', 'trunk')
    const config = await loadConfigIn(root)

    expect(config.git.baseBranch).toBe('develop')
  })

  it('keeps the existing non-git keys intact', async () => {
    const root = await makeRoot({
      'astrocms.json': JSON.stringify({
        contentDir: 'content',
        git: { prBasedEdits: true },
      }),
    })
    createdRoots.push(root)

    const config = await loadConfigIn(root)

    expect(config.contentDir).toBe('content')
    expect(config.contentConfig).toBe('src/content.config.ts')
    expect(config.git.prBasedEdits).toBe(true)
  })
})
