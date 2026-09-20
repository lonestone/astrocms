## General rules

- Never read `.env`. You can read `.env.example`.
- Don't co-author git commits with Claude.
- Never commit or push without explicit user approval, even for small follow-up fixes. One approval covers one commit, not the whole session.
- Commit on the current branch. When already on `main` and the user hasn't asked for a branch, commit directly on `main` (don't auto-create a branch).
- Never use Claude's user/project memory. When asked to remember something, add a minimal instruction here in `CLAUDE.md` (or in the relevant skill under `.claude/skills/`).
- Use Tailwind CSS for frontend styling. No raw CSS except in styles.css.
- Every hook and component should have its own file.

## Releasing

- After any change to `packages/astrocms/` is merged into `main`, propose a release: the npm package and the Docker image only ship on a version bump. Both are published by `.github/workflows/ci.yml` on push to `main` after the `test` job passes: the `publish` job builds the Docker image and `publish-npm` publishes the npm package. Each one skips when the current version is already out (`docker manifest inspect` for the image, `npm view` for the package). The npm job authenticates through npm trusted publishing (OIDC), so no npm token lives in the repository secrets; `NPM_TOKEN` stays a fallback for a package with no trusted publisher yet.
- Release steps, from `packages/astrocms/`, after user approval: `npm version <patch|minor> --no-git-tag-version`, commit `chore: release X.Y.Z`, tag `vX.Y.Z`, push `main` with tags. CI then builds `dist/` and publishes to npm and ghcr, so `npm publish` stays out of the local flow. Check the run with `gh run list --workflow ci.yml`.
- When the release fixes an issue, mention the version in a comment on that issue.

## Tech stack

- React (frontend)
- Tailwind CSS (frontend)
- Hono (backend)
- Vite (build)
- TypeScript

## Project structure

- `packages/astrocms/` - The CMS npm package
  - `backend/` - Hono backend server
    - `server.ts` - Entry point
    - `root.ts` - Resolves the target Astro project root directory
    - `config.ts` - Loads astrocms.json config
    - `routes/` - API routes (tree, file, git, claude, upload, components)
    - `stubs/` - Astro module mocks for loading content.config.ts at runtime
  - `frontend/` - React + Vite SPA
  - `bin/astrocms.js` - CLI entry point
- `example/` - Minimal Astro site using astrocms
- `Dockerfile` / `entrypoint.sh` - Docker image that clones a git repo and runs astrocms

## Content style

- Never use em dashes. Use other formulations instead.
- Prefer positive formulations over negative ones. Instead of "X, pas Y" or "ne pas Z", reformulate positively (e.g. "rester indépendant" instead of "ne pas dépendre", "dès le premier sprint" instead of "pas à la fin").
- Avoid label-colon patterns like "Objectif :", "Résultat :", "Avantage :". Integrate the information directly in the phrase.
