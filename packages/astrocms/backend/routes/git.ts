import { Hono } from 'hono'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { ROOT_DIR } from '../root.js'
import { loadConfig, type GitConfig } from '../config.js'
import {
  createPullRequest,
  findOpenPr,
  parseRepoFromUrl,
  type GitHubPr,
} from '../github.js'

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

async function getGitSettings(): Promise<GitConfig> {
  const config = await loadConfig()
  return config.git
}

/**
 * The branch HEAD is currently on. Empty string on a detached HEAD.
 */
async function getCurrentBranch(): Promise<string> {
  const out = await git('branch', '--show-current')
  return out.trim()
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

async function countCommits(range: string): Promise<number> {
  try {
    const out = await git('rev-list', '--count', range)
    const n = parseInt(out.trim(), 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

async function countBehind(branch: string): Promise<number> {
  return countCommits(`HEAD..origin/${branch}`)
}

/**
 * Fetch one branch from origin. Returns false when the branch does not exist
 * on the remote yet (e.g. a working branch that was never pushed).
 */
async function fetchBranch(branch: string): Promise<boolean> {
  try {
    await git('fetch', 'origin', branch)
    return true
  } catch {
    return false
  }
}

// --- Remote poll state ---

interface RemoteState {
  updateAvailable: boolean
  behind: number
  lastCheckedAt: number | null
  lastPulledAt: number | null
  error?: string
  aheadOfBase: number
  behindBase: number
  openPr: GitHubPr | null
  openPrError?: string
}

const remoteState: RemoteState = {
  updateAvailable: false,
  behind: 0,
  lastCheckedAt: null,
  lastPulledAt: null,
  aheadOfBase: 0,
  behindBase: 0,
  openPr: null,
}

/**
 * Sync the working branch with its remote ref when it is behind and the
 * worktree is clean (ff-only). Shared by both modes.
 */
async function syncWorkingBranch(branch: string): Promise<void> {
  const behind = await countBehind(branch)
  if (behind > 0) {
    const clean = await isWorktreeClean()
    if (clean) {
      await git('pull', '--ff-only', 'origin', branch)
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
}

async function checkRemote(): Promise<void> {
  try {
    const settings = await getGitSettings()
    await ensureAuthedRemote()

    if (settings.prBasedEdits) {
      const current = await getCurrentBranch()

      // The base branch must exist on the remote; a failure here is a real
      // error and lands in remoteState.error.
      await git('fetch', 'origin', settings.baseBranch)
      remoteState.behindBase = await countCommits(
        `HEAD..origin/${settings.baseBranch}`
      )
      remoteState.aheadOfBase = await countCommits(
        `origin/${settings.baseBranch}..HEAD`
      )

      if (current && current !== settings.baseBranch) {
        // The working branch may not exist on the remote yet.
        if (await fetchBranch(current)) {
          await syncWorkingBranch(current)
        } else {
          remoteState.behind = 0
          remoteState.updateAvailable = false
        }
      } else {
        // On the base branch: no working-branch ref to sync.
        remoteState.behind = 0
        remoteState.updateAvailable = false
      }

      // Best-effort open-PR lookup for the working branch. Skipped when the
      // origin is not a GitHub URL or no PAT is configured; failures land in
      // openPrError without affecting the git state above.
      remoteState.openPr = null
      remoteState.openPrError = undefined
      if (current && current !== settings.baseBranch) {
        try {
          // Read the stored origin URL straight from config: `git remote
          // get-url` would apply url.*.insteadOf rewrites, which can turn a
          // GitHub URL into a transport/mirror URL that no longer names the repo.
          const originUrl = await git('config', '--get', 'remote.origin.url')
          const parsed = parseRepoFromUrl(originUrl)
          if (parsed && process.env.GIT_PAT) {
            remoteState.openPr = await findOpenPr(
              parsed.owner,
              parsed.repo,
              current
            )
          }
        } catch (err) {
          remoteState.openPrError = String((err as any)?.message ?? err)
        }
      }
    } else {
      const branch = getBranch()
      await git('fetch', 'origin', branch)
      await syncWorkingBranch(branch)
    }

    remoteState.lastCheckedAt = Date.now()
    remoteState.error = undefined
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

/**
 * Git + PR state for the review UI, present in `/status` when PR-based edits
 * are enabled. `openPr` is filled by the GitHub client (see
 * docs/pr-based-edits.md, phase 3); until then it is always null.
 */
interface BranchInfo {
  prMode: boolean
  currentBranch: string
  baseBranch: string
  onBaseBranch: boolean
  aheadOfBase: number
  behindBase: number
  openPr: GitHubPr | null
  openPrError?: string
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

    const settings = await getGitSettings()
    let branch: BranchInfo | undefined
    if (settings.prBasedEdits) {
      const current = await getCurrentBranch()
      branch = {
        prMode: true,
        currentBranch: current,
        baseBranch: settings.baseBranch,
        onBaseBranch: current === settings.baseBranch,
        aheadOfBase: remoteState.aheadOfBase,
        behindBase: remoteState.behindBase,
        openPr: remoteState.openPr,
        ...(remoteState.openPrError
          ? { openPrError: remoteState.openPrError }
          : {}),
      }
    }

    return c.json({ files, remote: remoteSnapshot(), ...(branch ? { branch } : {}) })
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

  const settings = await getGitSettings()
  let currentBranch: string | undefined
  if (settings.prBasedEdits) {
    currentBranch = await getCurrentBranch()
    if (!currentBranch) {
      return c.json(
        { error: 'Detached HEAD: check out a branch before committing.' },
        400
      )
    }
    if (currentBranch === settings.baseBranch) {
      return c.json(
        {
          error: `PR-based edits are enabled, so the CMS never commits on '${settings.baseBranch}'. Create a working branch first.`,
        },
        400
      )
    }
  }

  try {
    const commitOutput = await git('commit', '-m', body.message)

    let pushOutput = ''
    if (body.push) {
      await ensureAuthedRemote()
      const branch = settings.prBasedEdits ? currentBranch! : getBranch()
      pushOutput = await git('push', 'origin', branch)
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
    const settings = await getGitSettings()
    let branch = getBranch()
    if (settings.prBasedEdits) {
      const current = await getCurrentBranch()
      if (!current || current === settings.baseBranch) {
        return c.json(
          {
            ok: false,
            error: `PR-based edits are enabled; pull a working branch, not '${settings.baseBranch}'.`,
          },
          400
        )
      }
      branch = current
    }
    const out = await git('pull', '--ff-only', 'origin', branch)
    remoteState.behind = 0
    remoteState.updateAvailable = false
    remoteState.lastPulledAt = Date.now()
    return c.json({ ok: true, output: out })
  } catch (err) {
    return c.json({ error: String((err as any)?.message ?? err) }, 500)
  }
})

// Create a working branch from the latest base (PR-based edits only).
gitRoutes.post('/branch', async (c) => {
  const body = await c.req.json<{ name?: string }>()
  const name = (body.name ?? '').trim()
  if (!name) {
    return c.json({ error: 'Missing branch name' }, 400)
  }

  const settings = await getGitSettings()
  if (!settings.prBasedEdits) {
    return c.json(
      { error: 'PR-based edits are disabled; enable git.prBasedEdits in astrocms.json.' },
      400
    )
  }

  try {
    // The name is passed as a positional argument to git below, so reject
    // option-like input up front; check-ref-format rejects the rest.
    if (name.startsWith('-')) {
      return c.json({ error: `Invalid branch name '${name}'` }, 400)
    }
    try {
      await git('check-ref-format', '--branch', name)
    } catch {
      return c.json({ error: `Invalid branch name '${name}'` }, 400)
    }
    if (name === settings.baseBranch) {
      return c.json(
        { error: `Cannot create a branch with the base branch name '${settings.baseBranch}'.` },
        400
      )
    }

    const clean = await isWorktreeClean()
    if (!clean) {
      return c.json(
        { ok: false, error: 'Working tree is not clean. Commit or discard changes first.' },
        400
      )
    }

    // Refuse to clobber an existing local branch.
    try {
      await git('show-ref', '--verify', '--quiet', `refs/heads/${name}`)
      return c.json({ error: `Branch '${name}' already exists.` }, 409)
    } catch {
      // No such local branch: proceed.
    }

    await ensureAuthedRemote()
    // Start from the freshly fetched base so the branch never lags behind.
    await git('fetch', 'origin', settings.baseBranch)
    await git('switch', '-c', name, `origin/${settings.baseBranch}`)

    // The branch switch invalidates the cached ahead/behind counts; force a
    // fresh remote check on the next status poll.
    remoteState.lastCheckedAt = null

    return c.json({ ok: true, branch: name })
  } catch (err) {
    return c.json({ error: String((err as any)?.message ?? err) }, 500)
  }
})

// Merge the latest base into the current working branch (PR-based edits only).
gitRoutes.post('/branch/update', async (c) => {
  const settings = await getGitSettings()
  if (!settings.prBasedEdits) {
    return c.json(
      { error: 'PR-based edits are disabled; enable git.prBasedEdits in astrocms.json.' },
      400
    )
  }

  try {
    const current = await getCurrentBranch()
    if (!current) {
      return c.json(
        { error: 'Detached HEAD: check out a working branch first.' },
        400
      )
    }
    if (current === settings.baseBranch) {
      return c.json(
        { error: `You are on the base branch '${settings.baseBranch}'; update a working branch instead.` },
        400
      )
    }

    const clean = await isWorktreeClean()
    if (!clean) {
      return c.json(
        { ok: false, error: 'Working tree is not clean. Commit or discard changes first.' },
        400
      )
    }

    await ensureAuthedRemote()
    await git('fetch', 'origin', settings.baseBranch)

    // Merge (not rebase): it never rewrites pushed history, so an open PR
    // doesn't need a force-push. On conflict the merge is left in progress:
    // the review UI shows the conflicted files, and resolving (or discarding)
    // them plus a commit concludes the merge.
    try {
      const out = await git('merge', `origin/${settings.baseBranch}`)
      return c.json({ ok: true, updated: !/already up to date/i.test(out) })
    } catch (err: any) {
      const message = String(err?.message ?? err)
      return c.json(
        { ok: false, error: `Merge conflict while updating from '${settings.baseBranch}': ${message}` },
        409
      )
    }
  } catch (err) {
    return c.json({ error: String((err as any)?.message ?? err) }, 500)
  }
})

/**
 * PR body: the list of files changed on the branch (three-dot diff against
 * the base, so only this branch's commits count) plus a fixed footer.
 * `nameStatusOutput` is the output of
 * `git diff --name-status origin/<base>...HEAD`; renames (R*) carry the new
 * path as their last field.
 */
function buildPrBody(nameStatusOutput: string): string {
  const lines = nameStatusOutput.split('\n').filter((l) => l.trim())
  const fileList = lines.length
    ? lines
        .map((line) => {
          const [status, ...paths] = line.split('\t')
          return `- ${status} ${paths[paths.length - 1]}`
        })
        .join('\n')
    : '- (no file changes)'
  return `## Changed files\n\n${fileList}\n\n---\nCreated with AstroCMS`
}

// Push the working branch and open its pull request (or reuse an existing
// one). PR-based edits only; non-PR mode keeps using /commit?push=true.
gitRoutes.post('/push', async (c) => {
  const body = await c.req.json<{ title?: string }>()

  const settings = await getGitSettings()
  if (!settings.prBasedEdits) {
    return c.json(
      { error: 'PR-based edits are disabled; enable git.prBasedEdits in astrocms.json.' },
      400
    )
  }

  const current = await getCurrentBranch()
  if (!current) {
    return c.json(
      { error: 'Detached HEAD: check out a working branch first.' },
      400
    )
  }
  if (current === settings.baseBranch) {
    return c.json(
      { error: `PR-based edits are enabled, so the CMS never pushes '${settings.baseBranch}'. Push a working branch instead.` },
      400
    )
  }

  try {
    await ensureAuthedRemote()

    // Resolve the GitHub repository from origin's URL before pushing, so a
    // missing title or unparseable origin doesn't leave a stray push behind.
    // Read the stored URL from config (not `git remote get-url`, which applies
    // url.*.insteadOf rewrites that could hide the GitHub origin).
    const originUrl = await git('config', '--get', 'remote.origin.url')
    const parsed = parseRepoFromUrl(originUrl)
    if (!parsed) {
      return c.json(
        { error: 'PR-based edits require a GitHub origin (https://github.com/<owner>/<repo>).' },
        400
      )
    }
    if (!process.env.GIT_PAT) {
      return c.json(
        { error: 'GIT_PAT is required to create pull requests.' },
        400
      )
    }

    const open = await findOpenPr(parsed.owner, parsed.repo, current)
    if (!open) {
      const title = (body.title ?? '').trim()
      if (!title) {
        return c.json({ error: 'Missing PR title' }, 400)
      }
    }

    await git('push', '-u', 'origin', current)

    if (open) {
      // An open PR already exists: the push is enough.
      remoteState.lastCheckedAt = null
      return c.json({ ok: true, pushed: true, pr: open })
    }

    await git('fetch', 'origin', settings.baseBranch)
    const changed = await git(
      'diff',
      '--name-status',
      `origin/${settings.baseBranch}...HEAD`
    )

    try {
      const pr = await createPullRequest(parsed.owner, parsed.repo, {
        title: (body.title ?? '').trim(),
        body: buildPrBody(changed),
        head: current,
        base: settings.baseBranch,
      })
      remoteState.lastCheckedAt = null
      return c.json({ ok: true, pushed: true, created: true, pr })
    } catch (err) {
      // The push already succeeded; report both facts so the UI can show
      // that the branch is up while PR creation failed.
      return c.json(
        { ok: false, pushed: true, error: String((err as any)?.message ?? err) },
        502
      )
    }
  } catch (err) {
    return c.json(
      { ok: false, pushed: false, error: String((err as any)?.message ?? err) },
      500
    )
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
