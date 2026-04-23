# AstroCMS

A simple, database-free CMS for [Astro](https://astro.build) static websites with first-class MDX support.

AstroCMS edits your Markdown and MDX files directly, manages media assets, commits and pushes to your GitHub repository, and ships with an optional Claude Code integration for AI-assisted authoring.

## Why AstroCMS

- **No database.** Your content lives in your repo as Markdown/MDX, and AstroCMS just edits the files.
- **Git-native workflow.** Changes are staged, committed, and pushed to GitHub directly from the UI.
- **Schema-aware.** Frontmatter forms are auto-generated from the Zod schemas in your `content.config.ts`.
- **MDX-ready.** Edit rich MDX visually, including your own Astro components with typed props and slots.
- **AI built in.** Optional Claude Code agent for drafting, rewriting, and fixing content.

## Features

- **Visual MDX editor** with a frontmatter form generated from your Zod collection schemas
- **File tree browser** for all Astro content collections
- **Astro component discovery** for inserting your own components into MDX with prop and slot editing
- **Media upload** to your configured assets directory
- **Git integration** with status, diff, stage, commit, and push without leaving the browser
- **Claude Code agent** (optional) for AI-assisted writing and editing
- **Password protection** for deployed instances

## Requirements

- Node.js 20+
- An Astro project with content collections (`src/content.config.ts`)

## Quickstart

Setup takes two steps. Really.

### Option 1, as a project dependency

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

### Option 2, global install

Install once, use on any Astro project:

```bash
npm install -g astrocms
```

Then, from any Astro project directory:

```bash
astrocms
```

AstroCMS operates on the current working directory (or the path in `ASTROCMS_ROOT`). Either way, it starts on `http://localhost:4001/astrocms`. Pass `--port <n>` to listen on a different port:

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
  "componentsDir": "src/components"
}
```

All fields are optional.

| Field | Purpose | Default |
|---|---|---|
| `contentDir` | Directory containing your content collections | `src/content` |
| `contentConfig` | Path to the Zod schema file | `src/content.config.ts` |
| `assetsDir` | Where uploaded media is written. If unset, uploads are disabled and the directory is never scanned. | *(uploads disabled)* |
| `componentsDir` | Astro components available in the MDX editor. If unset, component discovery is skipped entirely. | *(components disabled)* |

Any `astrocms.json` field can also be set via environment variable. Env values override the JSON file when both are present. This is useful for Docker deployments where the config lives outside the container image.

| Env var | Overrides |
|---|---|
| `ASTROCMS_CONTENT_DIR` | `contentDir` |
| `ASTROCMS_CONTENT_CONFIG` | `contentConfig` |
| `ASTROCMS_ASSETS_DIR` | `assetsDir` |
| `ASTROCMS_COMPONENTS_DIR` | `componentsDir` |

Deployment-only environment variables:

| Env var | Description | Default |
|---|---|---|
| `ASTROCMS_PASSWORD` | Optional password protection | *(none)* |
| `ASTROCMS_DEV_CMD` | Command to start the website dev server inside the container. When set, AstroCMS proxies the root path to the dev server. | *(none)* |
| `ASTROCMS_DEV_PORT` | Port the dev server listens on (used for the proxy and for probing). | `4321` when `ASTROCMS_DEV_CMD` is set |
| `ASTROCMS_INSTALL_CMD` | Override the project dependency install command in the container. By default the entrypoint auto-detects npm / pnpm / yarn / bun from the lockfile. | *(auto-detected)* |
| `GIT_REPO_URL` | Git repo URL (Docker mode) | *(auto-detected)* |
| `GIT_BRANCH` | Git branch | `main` |
| `GIT_PAT` | GitHub Personal Access Token | *(none)* |
| `GIT_USER_EMAIL` | Git commit email | `cms@astrocms.dev` |
| `GIT_USER_NAME` | Git commit author | `AstroCMS` |

A `.env` file at the project root is auto-loaded when running `astrocms` locally. Shell variables take precedence over `.env` values.

## Best practices

### Pass components to `<Content />` rather than importing them in MDX

MDX lets you `import` Astro components directly inside a `.mdx` file. It works, but **AstroCMS hides import statements in the visual editor** to keep MDX authoring WYSIWYG. If a page relies on imports inside the MDX, editors will still see the components but will not be able to manage or remove the imports from the editor UI.

The recommended pattern is to keep MDX files import-free and pass components through Astro's `<Content components={...} />` prop from the consuming page, like [`example/src/pages/[lang]/blog/[slug].astro`](./example/src/pages/%5Blang%5D/blog/%5Bslug%5D.astro):

```astro
---
import { render } from 'astro:content'
import { mdxComponents } from '../../../components'
// ...
const { Content } = await render(post)
---

<Content components={mdxComponents} />
```

### Auto-register every component in `componentsDir`

To keep the component list in sync with `ASTROCMS_COMPONENTS_DIR` (what the CMS shows in the MDX editor) without maintaining it by hand, use Vite's `import.meta.glob` to build the map automatically. See [`example/src/components/index.ts`](./example/src/components/index.ts):

```ts
const modules = import.meta.glob('./**/*.astro', { eager: true })

export const mdxComponents: Record<string, any> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [
    path.split('/').pop()!.replace('.astro', ''),
    (mod as any).default,
  ])
)
```

This way, any `.astro` file you drop into the components directory becomes available in MDX at both build time and in the CMS editor, with nothing to wire up.

## Deploying with Docker

AstroCMS publishes a prebuilt image to GitHub Container Registry on every release: `ghcr.io/lonestone/astrocms`. It clones a git-hosted Astro project into a persistent volume and serves the CMS.

Available tags:

- `latest`: most recent release
- `X.Y.Z`: a specific version (e.g. `0.1.2`), pinned for reproducibility
- `X.Y`: latest patch of a minor line (e.g. `0.1`)

### Quickstart with `docker run`

```bash
docker run -d \
  --name astrocms \
  -p 4001:4001 \
  -e GIT_REPO_URL=https://github.com/user/repo \
  -e GIT_PAT=github_pat_xxx \
  -e ASTROCMS_PASSWORD=secret \
  -v astrocms-data:/data \
  ghcr.io/lonestone/astrocms:latest
```

### With `docker compose`

```yaml
services:
  cms:
    image: ghcr.io/lonestone/astrocms:latest
    ports:
      - '4001:4001'
    environment:
      - GIT_REPO_URL=${GIT_REPO_URL}
      - GIT_PAT=${GIT_PAT}
      - ASTROCMS_PASSWORD=${ASTROCMS_PASSWORD}
    volumes:
      - astrocms-data:/data
    restart: unless-stopped

volumes:
  astrocms-data:
```

All config variables from the table above (`ASTROCMS_CONTENT_DIR`, `ASTROCMS_DEV_CMD`, etc.) can be passed through the same way.

The container uses a single persistent volume at `/data`. Inside, `/data/app` holds the cloned project (reused and fast-forwarded on restart instead of re-cloned) and `/data/claude` persists the Claude Code login across restarts. Both paths are symlinked into `/app` and `/root/.claude` at startup. The container always serves on port `4001` internally; change the host-side mapping to expose it elsewhere.

The CMS UI and its API live under `/astrocms`. Visit `http://localhost:4001/astrocms` to open it.

### Stateless mode (no persistent volume)

Drop the volume mount to make the container fully disposable. Every time it starts, it clones the repo fresh and the Claude login is reset:

```yaml
services:
  cms:
    image: ghcr.io/lonestone/astrocms:latest
    ports:
      - '4001:4001'
    environment:
      - GIT_REPO_URL=${GIT_REPO_URL}
      - GIT_PAT=${GIT_PAT}
      - ASTROCMS_PASSWORD=${ASTROCMS_PASSWORD}
    restart: unless-stopped
```

Pick this mode for Kubernetes deployments where pods are interchangeable, for preview environments that spin up per branch, or any setup where you want a clean state on every restart.

Things to know before using it:

- **Slower startup.** The repo is cloned and dependencies reinstalled on every container start (expect anywhere from 10 seconds to a few minutes depending on repo size and dependency count).
- **Local commits must be pushed before the container stops.** Anything committed in the CMS but not yet pushed is lost when the container is recreated. The "Commit and push" button in the CMS is the only safe workflow.
- **Claude Code re-login on every start.** Without the persistent `/data` volume, you have to re-authenticate Claude Code each time the container comes up.
- **Bandwidth and rate limits.** Frequent restarts mean frequent clones; on large repos this can hit GitHub's rate limits or slow cold starts noticeably.

### Serving the website alongside the CMS

Set `ASTROCMS_DEV_CMD` to run the website's own dev server inside the container. AstroCMS then proxies every request outside `/astrocms` to the website, so both live at the same origin:

```env
ASTROCMS_DEV_CMD=npm run dev
ASTROCMS_DEV_PORT=4321
```

With that, `http://localhost:4001/` serves the live site and `http://localhost:4001/astrocms` serves the CMS. A "Preview" button also appears in the CMS header whenever the dev server is reachable. Without `ASTROCMS_DEV_CMD`, the root path redirects to `/astrocms`.

### Generating a GitHub PAT

`GIT_PAT` must be a GitHub Personal Access Token with permission to clone, pull, and push on the target repository.

1. Go to https://github.com/settings/personal-access-tokens and click **Generate new token** (fine-grained).
2. **Repository access**: select **Only select repositories** and pick the repo you'll point `GIT_REPO_URL` at.
3. **Repository permissions**:
   - **Contents**: `Read and write` (required for clone, pull, push)
   - **Metadata**: `Read-only` (selected automatically)
4. Click **Generate token** and copy the value, which is shown only once.
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
