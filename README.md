# AstroCMS

A simple, database-free CMS for [Astro](https://astro.build) static websites with first-class MDX support.

AstroCMS edits your Markdown and MDX files directly, manages media assets, commits and pushes to your GitHub repository, and ships with an optional Claude Code integration for AI-assisted authoring.

## Why AstroCMS

- **No database.** Your content lives in your repo as Markdown/MDX — AstroCMS just edits the files.
- **Git-native workflow.** Changes are staged, committed, and pushed to GitHub directly from the UI.
- **Schema-aware.** Frontmatter forms are auto-generated from the Zod schemas in your `content.config.ts`.
- **MDX-ready.** Edit rich MDX visually, including your own Astro components with typed props and slots.
- **AI built in.** Optional Claude Code agent for drafting, rewriting, and fixing content.

## Features

- **Visual MDX editor** with a frontmatter form generated from your Zod collection schemas
- **File tree browser** for all Astro content collections
- **Astro component discovery** — insert your own components into MDX with prop and slot editing
- **Media upload** to your configured assets directory
- **Git integration** — status, diff, stage, commit, and push without leaving the browser
- **Claude Code agent** (optional) for AI-assisted writing and editing
- **Password protection** for deployed instances

## Requirements

- Node.js 20+
- An Astro project with content collections (`src/content.config.ts`)

## Quickstart

Setup takes two steps. Really.

### Option 1 — as a project dependency

Install it, then add a script:

```bash
npm install astrocms
```

```json
{
  "scripts": {
    "astrocms": "astrocms"
  }
}
```

Run it from your project:

```bash
npm run astrocms
```

### Option 2 — global install

Install once, use on any Astro project:

```bash
npm install -g astrocms
```

Then, from any Astro project directory:

```bash
astrocms
```

AstroCMS operates on the current working directory (or the path in `ASTROCMS_ROOT`). Either way, it starts on `http://localhost:4001`. Pass `--port <n>` to listen on a different port:

```bash
astrocms --port 5000
```

## Configuration

AstroCMS reads an optional `astrocms.json` at the project root:

```json
{
  "contentDir": "src/content",
  "contentConfig": "src/content.config.ts",
  "assetsDir": "src/assets",
  "componentsDir": "src/components",
  "websiteUrl": "http://localhost:4321"
}
```

All fields are optional.

| Field | Purpose | Default |
|---|---|---|
| `contentDir` | Directory containing your content collections | `src/content` |
| `contentConfig` | Path to the Zod schema file | `src/content.config.ts` |
| `assetsDir` | Where uploaded media is written. If unset, uploads are disabled and the directory is never scanned. | *(uploads disabled)* |
| `componentsDir` | Astro components available in the MDX editor. If unset, component discovery is skipped entirely. | *(components disabled)* |
| `websiteUrl` | URL opened by the header "Preview" button. If unset, the button is hidden. | *(hidden)* |

Any `astrocms.json` field can also be set via environment variable. Env values override the JSON file when both are present. This is useful for Docker deployments where the config lives outside the container image.

| Env var | Overrides |
|---|---|
| `ASTROCMS_CONTENT_DIR` | `contentDir` |
| `ASTROCMS_CONTENT_CONFIG` | `contentConfig` |
| `ASTROCMS_ASSETS_DIR` | `assetsDir` |
| `ASTROCMS_COMPONENTS_DIR` | `componentsDir` |
| `ASTROCMS_WEBSITE_URL` | `websiteUrl` |

Deployment-only environment variables:

| Env var | Description | Default |
|---|---|---|
| `ASTROCMS_PASSWORD` | Optional password protection | *(none)* |
| `GIT_REPO_URL` | Git repo URL (Docker mode) | *(auto-detected)* |
| `GIT_BRANCH` | Git branch | `main` |
| `GIT_PAT` | GitHub Personal Access Token | *(none)* |
| `GIT_USER_EMAIL` | Git commit email | `cms@astrocms.dev` |
| `GIT_USER_NAME` | Git commit author | `AstroCMS` |

## Deploying with Docker

Use the provided Docker image to clone and serve a git-hosted Astro project:

```bash
docker compose up
```

Configure via `.env` (see `.env.example`):

```env
GIT_REPO_URL=https://github.com/user/repo
GIT_BRANCH=main
GIT_PAT=ghp_xxx
ASTROCMS_PASSWORD=secret
```

The `app-data` volume is persistent: if a clone already exists at startup, it is reused instead of re-cloned. The container always serves on port `4001` internally; change the host-side mapping in `docker-compose.yml` to expose it elsewhere.

### Generating a GitHub PAT

`GIT_PAT` must be a GitHub Personal Access Token with permission to clone, pull, and push on the target repository.

1. Go to https://github.com/settings/personal-access-tokens and click **Generate new token** (fine-grained).
2. **Repository access**: select **Only select repositories** and pick the repo you'll point `GIT_REPO_URL` at.
3. **Repository permissions**:
   - **Contents**: `Read and write` (required for clone, pull, push)
   - **Metadata**: `Read-only` (selected automatically)
4. Click **Generate token** and copy the value — it's shown only once.
5. Paste it into `.env` as `GIT_PAT=github_pat_...`.

No other permissions are needed.

## Contributing

Want to hack on AstroCMS itself? See [DEVELOPMENT.md](./DEVELOPMENT.md).

## Tech stack

- **Backend:** [Hono](https://hono.dev) on Node
- **Frontend:** React 19 + [Vite](https://vitejs.dev) + [Tailwind CSS](https://tailwindcss.com)
- **Editor:** [MDXEditor](https://mdxeditor.dev) with schema-driven frontmatter
- **AI:** [Claude Code](https://claude.com/claude-code) via `ai-sdk-provider-claude-code`

## License

MIT © Lonestone

---

AstroCMS is a non-profit, open-source project. AstroCMS and Lonestone are not affiliated with, endorsed by, or sponsored by The Astro Technology Company; this project simply targets the open-source Astro framework.
