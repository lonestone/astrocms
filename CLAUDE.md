## General rules

- Never read `.env`. You can read `.env.example`.
- Don't co-author git commits with Claude.

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

## Guidelines

- Use Tailwind CSS for frontend styling. No raw CSS except in styles.css.
- Project config (`contentDir`, `contentConfig`, `assetsDir`, `componentsDir`, `websiteUrl`) lives in `astrocms.json`. Each field can be overridden via env (`ASTROCMS_CONTENT_DIR`, `ASTROCMS_WEBSITE_URL`, etc.). Deployment-only env vars: `ASTROCMS_PASSWORD`, `GIT_*`. Port is selected via the `--port` CLI flag.
- `ROOT_DIR` always points to the target Astro project root, resolved from `ASTROCMS_ROOT` env var or `process.cwd()`.

## Content style

- Never use em dashes. Use other formulations instead.
- Prefer positive formulations over negative ones. Instead of "X, pas Y" or "ne pas Z", reformulate positively (e.g. "rester indépendant" instead of "ne pas dépendre", "dès le premier sprint" instead of "pas à la fin").
- Avoid label-colon patterns like "Objectif :", "Résultat :", "Avantage :". Integrate the information directly in the phrase.
