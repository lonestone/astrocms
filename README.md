# AstroCMS

A web-based CMS for Astro content collections. Edit MDX content, manage frontmatter, browse files, commit and push changes via git, and optionally use Claude as an AI assistant.

## Features

- Visual MDX editor with frontmatter form (auto-generated from Zod schemas in `content.config.ts`)
- File tree browser for Astro content collections
- Astro component discovery with prop/slot editing
- Git integration (status, diff, stage, commit, push)
- Claude Code agent integration (optional)
- Media upload

## Usage

### As an npm package

Install in your Astro project:

```bash
npm install astrocms
```

Add a script to your `package.json`:

```json
{
  "scripts": {
    "cms": "astrocms"
  }
}
```

Run it:

```bash
npm run cms
```

The CMS starts on `http://localhost:4001` and operates on your project directory.

### With Docker

Use the provided Docker image to clone and serve a git-hosted Astro project:

```bash
docker compose up
```

Configure via `.env` (see `.env.example`):

```env
GIT_REPO_URL=https://github.com/user/repo
GIT_BRANCH=main
GIT_PAT=ghp_xxx
CMS_PASSWORD=secret
```

The `app-data` volume is persistent: if a clone already exists at startup, it will be reused instead of re-cloned.

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

## Configuration

AstroCMS reads an optional `astrocms.json` at the project root:

```json
{
  "contentDir": "src/content",
  "contentConfig": "src/content.config.ts",
  "assetsDir": "src/assets",
  "componentsDir": "src/components"
}
```

All fields are optional. Defaults: `contentDir` = `src/content`, `contentConfig` = `src/content.config.ts`. `assetsDir` and `componentsDir` are disabled by default.

Environment variables (not in `astrocms.json`):

| Env var | Description | Default |
|---|---|---|
| `CMS_PORT` | Server port | `4001` |
| `CMS_PASSWORD` | Optional password protection | (none) |
| `GIT_REPO_URL` | Git repo URL (Docker mode) | (auto-detected) |
| `GIT_BRANCH` | Git branch | `main` |
| `GIT_PAT` | GitHub Personal Access Token | (none) |
| `GIT_USER_EMAIL` | Git commit email | `cms@astrocms.dev` |
| `GIT_USER_NAME` | Git commit author | `AstroCMS` |

## Development

```bash
# Install dependencies
npm install

# Run the example site with CMS
cd example
npm run cms
```

## Project structure

```
packages/astrocms/   # The CMS package
  server.ts          # Hono backend
  config.ts          # Config loader (astrocms.json + env vars)
  routes/            # API routes
  frontend/          # React + Vite SPA
  bin/astrocms.js    # CLI entry point
example/             # Minimal Astro site using astrocms
Dockerfile           # Docker image
```
