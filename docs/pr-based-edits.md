# PR-Based Edits (implementation plan)

Status: draft, 2026-09-14. Working document for the "PR-Based Edits" feature; delete or archive once shipped (precedent: component parser test plan).

## Goal

Let users opt in, per project via `astrocms.json`, to a workflow where the CMS
never commits or pushes directly to the base branch (main/master). Instead, edits
happen on a working branch that the user creates from the UI. Pushing opens a pull
request (or, if one is already open for the branch, simply pushes). The UI always
shows the current git and PR state.

Requirements:

1. Feature flag in `astrocms.json` ("PR-Based Edits").
2. Edits never land on main/master while the feature is on.
3. User can create a new working branch from the UI.
4. The current branch is displayed.
5. The UI shows when the working branch needs updating (behind base).
6. Committing works as today.
7. Pushing creates a PR with a user-provided title; if an open PR already exists
   for the branch, only push.
8. A persistent place in the UI shows git + PR state.
9. All new behavior is covered by tests.

Non-goals for v1: switching between multiple working branches in the UI, rebasing,
merging PRs from the CMS, CI check status display, forges other than GitHub.

## Current state (what we build on)

- `backend/routes/git.ts` shells out to git through one helper. The branch is a
  single value from `GIT_BRANCH || 'main'` (`getBranch()`). Endpoints:
  `/status`, `/remote-status`, `/diffs`, `/stage`, `/unstage`, `/commit`
  (optional `push`), `/pull`, `/discard-hunk`, `/discard`.
- Remote auth: `GIT_PAT` + `GIT_REPO_URL` are injected into the origin URL
  (`ensureAuthedRemote()`).
- A throttled (60 s) `checkRemote()` fetches the branch and auto ff-pulls when
  the worktree is clean; `remoteState` feeds `/status.remote` and
  `/remote-status`.
- Frontend: react-query hooks in `features/git/hooks/useGit.ts`, review UI in
  `features/git/components/GitReview.tsx` (commit + push, agent auto-publish),
  `HeaderMenu.tsx` shows "update available" and pulls.
- Config: flat keys in `astrocms.json` with env overrides, cached in
  `backend/config.ts`.
- The Claude agent route (`routes/claude.ts`) auto-allows `Bash(git:*)`, so the
  agent can run any git command, including pushes.

## Config design

```json
{
  "git": {
    "prBasedEdits": true,
    "baseBranch": "main"
  }
}
```

- `git.prBasedEdits` (boolean, default `false`) is the feature flag.
- `git.baseBranch` (string, optional) names the protected branch. Default:
  `GIT_BRANCH` env if set, else `main`. Note the semantic shift of `GIT_BRANCH`
  in PR mode: it names the base branch, not a working branch. Document this in
  the README.
- `config.ts`: extend `AstroCmsConfig` with a nested `git` object and merge it in
  `loadConfig()`. Keep the env-override pattern; add `ASTROCMS_PR_BASED_EDITS`
  (and optionally `ASTROCMS_GIT_BASE_BRANCH`) so Docker users can flip the flag
  without touching the cloned repo.

## Branch model

- The base branch is read-only for the CMS: no commits, no pushes.
- A working branch is any non-base branch. Git HEAD is the single source of
  truth for "current branch"; no extra state file.
- Guards (backend, in PR mode): while HEAD is on the base branch, `/commit` and
  `/push` return 400 with a message pointing at "create a working branch".
- Branch creation: `POST /git/branch` with `{ name }`.
  - Validate the name with `git check-ref-format --branch <name>`.
  - Require a clean worktree (same guard style as `/pull`).
  - `git fetch origin <base>` then `git switch -c <name> origin/<base>` so the
    branch always starts from the latest base.
- Branch update: `POST /git/branch/update`.
  - Require a clean worktree.
  - `git fetch origin <base>` then `git merge origin/<base>`. Merge (not rebase)
    in v1: it never rewrites already-pushed history, so no force-push is needed
    for an open PR. Conflicts return 409 with the git output; the user resolves
    or discards manually.
- Ahead/behind counts, computed after a fetch:
  - `aheadOfBase = rev-list --count origin/<base>..HEAD`
  - `behindBase = rev-list --count HEAD..origin/<base>`

## Push + PR flow

New endpoint `POST /git/push` with body `{ title? }`:

1. In PR mode, reject when HEAD is on the base branch (400).
2. `ensureAuthedRemote()`, then `git push -u origin <branch>`.
3. GitHub API (see below): look up an open PR with `head = <owner>:<branch>`.
   - Found: return `{ pushed: true, pr }` without needing a title.
   - Not found: `title` is required (400 if missing), then create the PR with
     `{ title, body, head: <branch>, base: <baseBranch> }` and return
     `{ pushed: true, pr, created: true }`. The body is a fixed
     "Created with AstroCMS" footer plus the list of changed files on the
     branch (from `git diff --name-status origin/<base>...HEAD`).

The existing `/commit?push=true` keeps working unchanged in non-PR mode. In PR
mode the frontend stops sending `push: true` to `/commit` and uses `/git/push`
instead, so the PR logic lives in exactly one place.

### GitHub client

New module `backend/github.ts`, a small fetch-based client:

- `parseRepoFromUrl(url)` → `{ owner, repo }` from
  `https://github.com/<owner>/<repo>[.git]`. PR mode requires a parseable
  GitHub URL; otherwise `/git/push` fails with a clear error.
- `findOpenPr(owner, repo, head)` → `GET /repos/{owner}/{repo}/pulls?state=open&head={owner}:{branch}`
- `createPullRequest(owner, repo, { title, head, base })` →
  `POST /repos/{owner}/{repo}/pulls`
- The API base URL is injectable (default `https://api.github.com`) so tests can
  point it at a local mock server. Auth reuses `GIT_PAT`.

### PAT permissions (README update)

Fine-grained tokens need, in addition to today's Contents: Read and write:

- **Pull requests**: `Read and write` (create + list PRs)

## Git + PR state in the UI

Extend `GET /git/status` (already polled by the review screen) with a `branch`
object when PR mode is on:

```json
{
  "files": [ ... ],
  "remote": { "...existing...": "" },
  "branch": {
    "prMode": true,
    "currentBranch": "astrocms/fix-typo",
    "baseBranch": "main",
    "onBaseBranch": false,
    "aheadOfBase": 2,
    "behindBase": 1,
    "openPr": { "number": 7, "title": "...", "url": "https://github.com/.../pull/7" }
  }
}
```

`openPr` is `null` when there is no open PR or the GitHub lookup failed (surface
the failure as an `error` string, same style as `remote.error`).

In PR mode, `checkRemote()` fetches both the current branch and the base branch;
`behindBase > 0` drives the "needs updating" indicator.

### UI changes (GitReview, always visible)

- Branch chip in the header: current branch name. On the base branch it renders
  as a warning with a "Create branch" button; commits/push are disabled.
- Badges next to the chip: `2 ahead`, and when behind, `1 behind main` plus an
  "Update from main" button (calls `/git/branch/update`).
- Open PR: a link "PR #7 · title" (new tab). No open PR and `aheadOfBase > 0`:
  hint "Push to open a pull request".
- New branch dialog: free-form name input prefilled with the `astrocms/`
  prefix, create button, error display for invalid names or a dirty worktree.
- Commit area in PR mode: "Commit" (no push) plus a separate "Push & open PR"
  button with a title input. The title defaults to the latest commit subject and
  is only required when no open PR exists; with an open PR the button becomes a
  plain "Push".

`HeaderMenu.tsx`: keep the pull behavior for non-PR mode; in PR mode the
"update available" concept is covered by `behindBase` and the update button.

## Agent (Claude) considerations

The agent route auto-allows `Bash(git:*)`, so it could push to the base branch
directly. Options, in increasing strength:

1. Route-level guards only (UI paths) plus a prompt note for the agent that in
   PR mode it must stay on the working branch.
2. Narrow `allowedTools` in PR mode (drop blanket `Bash(git:*)`, allow
   status/diff/add/commit/log and push only for the current working branch).
3. Install a local `pre-push` hook (via `core.hooksPath`) that rejects any
   refspec targeting the base branch. This covers every path, including manual
   agent commands, but writes into the user's repo and needs documentation.

Decision (confirmed): option 2 for v1, with option 3 as a follow-up if we
want a hard guarantee. The CMS keeps HEAD off the base branch in normal
operation, which already removes the most likely accident.

## Testing strategy

Automated (vitest, following the hermetic tmp-root pattern from
`tests/parsers/components-scan.test.ts`):

- Unit: `parseRepoFromUrl`, branch name validation, PR response mapping.
- Integration with a real local git repo: create a bare repo as `origin` in a
  tmp dir, clone it, and drive the git route handlers (Hono `app.request()` or
  direct handler calls). Covers: branch creation from latest base, commit guard
  on the base branch (400), push with upstream, ahead/behind counts, update
  merge including the conflict case (409). No network and no GitHub involved.
- GitHub API: a mock server via `node:http` (or the injectable base URL) that
  emulates `GET/POST /repos/{owner}/{repo}/pulls`. Covers: open PR exists →
  push only, no PR → create with the given title, missing title → 400.

Manual E2E (checklist in the PR description):

- Scratch project: copy `example/` to a tmp folder, `git init`, add a remote
  (local bare repo for branch/push logic, or a throwaway GitHub repo + PAT for
  the full PR flow). Point `ASTROCMS_ROOT` at it and run `astrocms:dev`.
- Optional full-stack local E2E without GitHub: Gitea in Docker exposes a
  GitHub-compatible `/pulls` API; point `GIT_REPO_URL` at it.

Why not test in `example/` directly: it is part of this monorepo and not its own
git repo; `git init`-ing inside it would create a nested repository. A scratch
copy keeps the monorepo clean and reproduces exactly what an end user has (a
standalone site repo).

## Phases

1. **Config + branch state (backend)** — done: `git` config block, base/working
   branch split in `routes/git.ts`, commit/push guards on the base branch,
   `branch` object in `/status`. Tests: config loading, guards.
2. **Branch endpoints** — done: `POST /git/branch` (name validated via
   `check-ref-format`, clean-tree guard, starts from freshly fetched base,
   409 on existing local branch) and `POST /git/branch/update` (merge of
   `origin/<base>`, 409 on conflict with the merge left in progress so the
   review UI can resolve/discard, `updated` flag for no-ops). Both reset the
   remote-check throttle so `/status` re-polls immediately. Tests with a bare
   local origin, including the conflict → discard → commit resolution flow.
3. **GitHub client + push/PR**: `backend/github.ts`, `POST /git/push` with PR
   create-or-reuse. Tests against the mock API server.
4. **Frontend**: branch chip, ahead/behind badges, update button, new-branch
   dialog, push & open PR flow with title input.
5. **Docs + E2E**: README (config section, `GIT_BRANCH` semantics, PAT
   permissions), `.env.example`, manual E2E checklist run against a throwaway
   GitHub repo.

## Decisions (2026-09-14)

- Working branch name: free choice, dialog input prefilled with `astrocms/`.
- PR body: fixed "Created with AstroCMS" footer plus the list of changed files
  on the branch.
- Env override for the flag: yes, `ASTROCMS_PR_BASED_EDITS` (file value wins
  when the env var is unset, matching the existing `pick()` pattern).
- Docker entrypoint: no change for now. The container starts on the base
  branch; the UI creates the working branch explicitly.
