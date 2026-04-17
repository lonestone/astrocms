# Development

This guide is for contributors hacking on AstroCMS itself. If you just want to use AstroCMS on your Astro project, see the [README](./README.md) instead.

## Repo layout

The repo is an npm workspaces monorepo:

- `packages/astrocms/` — the published `astrocms` package
  - `backend/` — Hono backend (`server.ts` entry, `routes/`, `config.ts`, `root.ts`, `stubs/`)
  - `frontend/` — React 19 + Vite SPA
  - `bin/astrocms.js` — CLI entry point
- `example/` — a minimal Astro site wired to the local `astrocms` package — the sandbox for testing changes
- `Dockerfile` / `entrypoint.sh` — Docker image that clones a git repo and runs AstroCMS

## Getting started

```bash
# Install dependencies (workspaces pick up packages/astrocms and example)
npm install

# Start the CMS against the example site, in dev mode
cd example
npm run astrocms:dev
```

## `astrocms` vs `astrocms:dev`

There are two modes, exposed by the CLI in `packages/astrocms/bin/astrocms.js`:

| Command | What it does | When to use |
|---|---|---|
| `astrocms` | Builds the frontend once (if `dist/` is missing), then starts the Hono backend which serves the prebuilt SPA. | Normal CMS use. This is what end users run. |
| `astrocms --dev` | Runs the backend with `tsx watch` and the frontend with `vite dev` (HMR). | Hacking on AstroCMS — source changes reload instantly. |

The `example/package.json` pre-wires both:

```json
{
  "scripts": {
    "astrocms": "astrocms",
    "astrocms:dev": "astrocms --dev"
  }
}
```

For day-to-day development, use `npm run astrocms:dev`.

## Useful scripts

From `packages/astrocms/`:

```bash
npm run dev           # backend (tsx watch) + frontend (vite dev), for hacking outside the example
npm run dev:server    # backend only
npm run dev:frontend  # frontend only
npm run build         # build the frontend SPA to dist/
```

## Docker image

```bash
docker compose up
```

See the [README](./README.md#deploying-with-docker) for the env vars and PAT setup. The image clones the repo from `GIT_REPO_URL` into a persistent `app-data` volume, then runs `astrocms`.

## Environment variables at a glance

- `ASTROCMS_ROOT` — target Astro project root. Defaults to `process.cwd()`. The CLI sets it automatically for the running process.
- `ASTROCMS_DEV` — set to `1` by the CLI when `--dev` is passed; the backend skips static serving so Vite can own the frontend.
- `ASTROCMS_PORT`, `ASTROCMS_PASSWORD`, `GIT_*` — see the [README](./README.md#configuration).
