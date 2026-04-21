import { Hono } from 'hono'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { ROOT_DIR } from '../root.js'

const exec = promisify(execFile)

let gitRoot: string | undefined

async function getGitRoot() {
  if (!gitRoot) {
    const { stdout } = await exec('git', ['rev-parse', '--show-toplevel'], {
      cwd: ROOT_DIR,
    })
    gitRoot = stdout.trimEnd()
  }
  return gitRoot
}

async function git(...args: string[]) {
  const root = await getGitRoot()
  // `core.quotepath=false` emits filenames literally as UTF-8 instead of
  // C-style escape sequences like "d\303\251j\303\240.png", so paths we read
  // from porcelain/diff output round-trip cleanly back into `git add` etc.
  const { stdout } = await exec(
    'git',
    ['-c', 'core.quotepath=false', ...args],
    {
      cwd: root,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    }
  )
  return stdout.trimEnd()
}

function getBranch() {
  return process.env.GIT_BRANCH || 'main'
}

async function ensureAuthedRemote() {
  const pat = process.env.GIT_PAT
  const repoUrl = process.env.GIT_REPO_URL
  if (pat && repoUrl) {
    const authedUrl = repoUrl.replace(
      'https://',
      `https://x-access-token:${pat}@`
    )
    await git('remote', 'set-url', 'origin', authedUrl)
  }
}

async function isWorktreeClean(): Promise<boolean> {
  const status = await git('status', '--porcelain')
  return status.trim().length === 0
}

async function countBehind(): Promise<number> {
  const branch = getBranch()
  try {
    const out = await git('rev-list', '--count', `HEAD..origin/${branch}`)
    const n = parseInt(out.trim(), 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

// --- Remote poll state ---

interface RemoteState {
  updateAvailable: boolean
  behind: number
  lastCheckedAt: number | null
  lastPulledAt: number | null
  error?: string
}

const remoteState: RemoteState = {
  updateAvailable: false,
  behind: 0,
  lastCheckedAt: null,
  lastPulledAt: null,
}

async function checkRemote(): Promise<void> {
  try {
    await ensureAuthedRemote()
    await git('fetch', 'origin', getBranch())
    const behind = await countBehind()
    remoteState.lastCheckedAt = Date.now()
    remoteState.error = undefined
    if (behind > 0) {
      const clean = await isWorktreeClean()
      if (clean) {
        await git('pull', '--ff-only', 'origin', getBranch())
        remoteState.behind = 0
        remoteState.updateAvailable = false
        remoteState.lastPulledAt = Date.now()
      } else {
        remoteState.behind = behind
        remoteState.updateAvailable = true
      }
    } else {
      remoteState.behind = 0
      remoteState.updateAvailable = false
    }
  } catch (err) {
    remoteState.error = String((err as any)?.message ?? err)
    remoteState.lastCheckedAt = Date.now()
  }
}

const REMOTE_CHECK_THROTTLE_MS = 60_000
let checkInFlight = false

/**
 * Fire-and-forget remote check, called from the hot path (`/status`,
 * `/remote-status`). Runs at most once per REMOTE_CHECK_THROTTLE_MS so
 * a burst of UI requests doesn't flood `git fetch`.
 */
function checkRemoteIfStale(): void {
  if (checkInFlight) return
  const last = remoteState.lastCheckedAt ?? 0
  if (Date.now() - last < REMOTE_CHECK_THROTTLE_MS) return
  checkInFlight = true
  checkRemote().finally(() => {
    checkInFlight = false
  })
}

export const gitRoutes = new Hono()

// Git status (file list with staged info).
// `-uall` enumerates files inside untracked directories individually so they
// each get a row in the review UI instead of collapsing to just the dir.
function remoteSnapshot() {
  return {
    updateAvailable: remoteState.updateAvailable,
    behind: remoteState.behind,
    lastCheckedAt: remoteState.lastCheckedAt,
    lastPulledAt: remoteState.lastPulledAt,
    error: remoteState.error,
    branch: getBranch(),
  }
}

interface PorcelainEntry {
  indexStatus: string
  worktreeStatus: string
  path: string
}

/**
 * Parse `git status --porcelain -z` output. `-z` uses NUL as the record
 * separator and disables all quoting, so paths containing spaces or
 * non-ASCII characters round-trip cleanly. Renames/copies (R/C) emit the
 * origin path as an extra NUL-terminated field right after the main one;
 * we drop it since the UI only cares about the current path.
 */
function parsePorcelainZ(raw: string): PorcelainEntry[] {
  const fields = raw.split('\0')
  const out: PorcelainEntry[] = []
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i]
    if (!entry || entry.length < 3) continue
    const indexStatus = entry[0]
    const worktreeStatus = entry[1]
    const path = entry.substring(3)
    out.push({ indexStatus, worktreeStatus, path })
    if (indexStatus === 'R' || indexStatus === 'C') i++ // skip origin path
  }
  return out
}

gitRoutes.get('/status', async (c) => {
  // Piggyback a throttled remote check on the most-called endpoint. Non
  // blocking: the request returns immediately with whatever we know now;
  // the follow-up fetch updates `lastPulledAt` and the UI detects the
  // change on its next status fetch.
  checkRemoteIfStale()
  try {
    const raw = await git('status', '--porcelain', '-z', '-uall')
    const files = parsePorcelainZ(raw)
      .map(({ indexStatus, worktreeStatus, path }) => {
        const status =
          indexStatus !== ' ' && indexStatus !== '?'
            ? indexStatus
            : worktreeStatus !== ' '
            ? worktreeStatus
            : indexStatus
        return {
          status,
          staged: indexStatus !== ' ' && indexStatus !== '?',
          path,
        }
      })
      // Sort by path so the row order stays stable when a file toggles
      // between staged and unstaged (git's native output groups by status).
      .sort((a, b) => a.path.localeCompare(b.path))
    return c.json({ files, remote: remoteSnapshot() })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

gitRoutes.get('/remote-status', (c) => {
  checkRemoteIfStale()
  return c.json(remoteSnapshot())
})

/**
 * Split a unified diff produced by `git diff` into a per-file map keyed by the
 * `b/` (post-image) path. Expects the standard `diff --git a/X b/X` header.
 */
function splitDiffByFile(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw) return out
  let currentPath: string | null = null
  let buf: string[] = []
  for (const line of raw.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (currentPath) out[currentPath] = buf.join('\n')
      buf = [line]
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/)
      currentPath = match ? match[2] : null
    } else {
      buf.push(line)
    }
  }
  if (currentPath) out[currentPath] = buf.join('\n')
  return out
}

// All diffs in one shot: tracked changes (staged + unstaged vs HEAD) plus
// synthesized "added file" diffs for every untracked file. Returns a map
// keyed by file path so the UI can render all of them without N per-file
// round-trips.
gitRoutes.get('/diffs', async (c) => {
  try {
    const statusOut = await git('status', '--porcelain', '-z', '-uall')
    const untracked = parsePorcelainZ(statusOut)
      .filter((e) => e.indexStatus === '?')
      .map((e) => e.path)

    const trackedDiff = await git('diff', 'HEAD')
    const diffs = splitDiffByFile(trackedDiff)

    for (const path of untracked) {
      try {
        const out = await git('diff', '--no-index', '--', '/dev/null', path)
        diffs[path] = out
      } catch (err: any) {
        // `git diff --no-index` exits with status 1 when files differ;
        // stdout still carries the diff body in that case.
        if (err?.stdout) diffs[path] = String(err.stdout)
        else diffs[path] = ''
      }
    }

    return c.json({ diffs })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// Stage files. `-A` (--all) is required so new deletions stage correctly
// (`git add -- deleted_file` alone fails with "pathspec did not match").
// We also filter out paths that are already fully staged to stay safe if
// the caller sends redundant entries — running `git add` on an already
// staged deletion, for instance, would error out.
gitRoutes.post('/stage', async (c) => {
  const body = await c.req.json<{ paths: string[] }>()
  if (!body.paths?.length) {
    return c.json({ error: 'Missing paths' }, 400)
  }
  try {
    const statusOut = await git(
      'status',
      '--porcelain',
      '-z',
      '-uall',
      '--',
      ...body.paths
    )
    const pending = new Set<string>()
    for (const { worktreeStatus, path } of parsePorcelainZ(statusOut)) {
      // worktree != ' ' covers modifications, deletions, and untracked files
      // (porcelain writes '??' for untracked).
      if (worktreeStatus !== ' ') pending.add(path)
    }
    const toStage = body.paths.filter((p) => pending.has(p))
    if (toStage.length) {
      await git('add', '-A', '--', ...toStage)
    }
    return c.json({ ok: true, staged: toStage.length })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// Unstage files
gitRoutes.post('/unstage', async (c) => {
  const body = await c.req.json<{ paths: string[] }>()
  if (!body.paths?.length) {
    return c.json({ error: 'Missing paths' }, 400)
  }
  try {
    await git('reset', 'HEAD', '--', ...body.paths)
    return c.json({ ok: true })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// Commit staged files and optionally push
gitRoutes.post('/commit', async (c) => {
  const body = await c.req.json<{ message: string; push?: boolean }>()
  if (!body.message) {
    return c.json({ error: 'Missing commit message' }, 400)
  }

  try {
    const commitOutput = await git('commit', '-m', body.message)

    let pushOutput = ''
    if (body.push) {
      await ensureAuthedRemote()
      pushOutput = await git('push', 'origin', getBranch())
    }

    return c.json({ ok: true, commit: commitOutput, push: pushOutput })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})

// Pull from remote
gitRoutes.post('/pull', async (c) => {
  try {
    await ensureAuthedRemote()
    const clean = await isWorktreeClean()
    if (!clean) {
      return c.json(
        {
          ok: false,
          error: 'Working tree is not clean. Commit or discard changes first.',
        },
        400
      )
    }
    const out = await git('pull', '--ff-only', 'origin', getBranch())
    remoteState.behind = 0
    remoteState.updateAvailable = false
    remoteState.lastPulledAt = Date.now()
    return c.json({ ok: true, output: out })
  } catch (err) {
    return c.json({ error: String((err as any)?.message ?? err) }, 500)
  }
})

// Discard a specific hunk (single @@ block) from the working tree.
// The hunk comes from `git diff HEAD`, so it can span both staged and
// unstaged changes. We unstage the file first so the worktree is the
// source of truth, then reverse-apply the hunk.
gitRoutes.post('/discard-hunk', async (c) => {
  const body = await c.req.json<{ path: string; hunk: string }>()
  if (!body.path || !body.hunk) {
    return c.json({ error: 'Missing path or hunk' }, 400)
  }
  if (body.path.includes('..')) {
    return c.json({ error: 'Invalid path' }, 400)
  }

  const hunkBody = body.hunk.endsWith('\n') ? body.hunk : body.hunk + '\n'
  const patch = [
    `diff --git a/${body.path} b/${body.path}`,
    `--- a/${body.path}`,
    `+++ b/${body.path}`,
    hunkBody,
  ].join('\n')

  try {
    const root = await getGitRoot()

    // Drop any staging for this file so the patch applies to the worktree only
    try {
      await git('reset', 'HEAD', '--', body.path)
    } catch {
      // Ignore: file may not be tracked in HEAD yet (newly added)
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn('git', ['apply', '--reverse'], { cwd: root })
      let stderr = ''
      child.stderr.on('data', (b) => (stderr += b.toString()))
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve()
        else
          reject(
            new Error(stderr.trim() || `git apply exited with code ${code}`)
          )
      })
      child.stdin.write(patch)
      child.stdin.end()
    })

    return c.json({ ok: true })
  } catch (err) {
    return c.json(
      { error: String((err as any)?.message ?? err) },
      500
    )
  }
})

// Discard all changes for a specific file (staged + unstaged)
gitRoutes.post('/discard', async (c) => {
  const body = await c.req.json<{ path: string }>()
  if (!body.path) {
    return c.json({ error: 'Missing path' }, 400)
  }

  if (body.path.includes('..')) {
    return c.json({ error: 'Invalid path' }, 400)
  }

  try {
    // porcelain format: XY where X=index (staged), Y=worktree
    const status = await git(
      'status',
      '--porcelain',
      '-z',
      '--',
      body.path
    )
    const indexStatus = status[0]

    if (indexStatus === '?') {
      // Untracked file: delete it
      const root = await getGitRoot()
      await unlink(join(root, body.path))
    } else if (indexStatus === 'A') {
      // Newly added (staged): unstage then delete
      await git('reset', 'HEAD', '--', body.path)
      const root = await getGitRoot()
      await unlink(join(root, body.path))
    } else {
      // Tracked file: fully restore to HEAD
      await git('checkout', 'HEAD', '--', body.path)
    }
    return c.json({ ok: true, path: body.path })
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }
})
