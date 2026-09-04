---
name: screenshots
description: Regenerate the README screenshots of AstroCMS (blog post editing and agent panel, in light and dark). Use when the UI changed, when the README images look stale, or when asked for a new marketing screenshot of the CMS.
---

# README screenshots

`npm run screenshots` (from the repo root) rebuilds the four PNGs in `docs/screenshots/`:

| File | Scene |
|---|---|
| `editor-light.png` / `editor-dark.png` | Editing a blog post: file tree, frontmatter form, visual MDX editor |
| `agent-light.png` / `agent-dark.png` | The agent panel answering "Write a blog post about AstroCMS", with its tool calls, next to the generated post |

The README references them by raw GitHub URL, so a run followed by a push to `main` is enough to refresh what npmjs.com and GitHub display.

## How it works

`scripts/screenshots/capture.mjs` drives the real product and touches nothing in `packages/astrocms/`:

1. Copies the synthetic posts from `scripts/screenshots/fixtures/content/` into `example/src/content/`, and duplicates two example images next to the post that references them (`fixtures/assets.json`).
2. Builds `packages/astrocms/dist` and starts the real Hono backend against `example/` on port 4399.
3. Opens the real frontend in Playwright Chromium at 1440x900, `deviceScaleFactor: 2`.
4. Intercepts, in the browser only, the four endpoints that would otherwise need a live Claude session or a dirty working tree: `claude/status`, `claude/conversations`, `claude/chat`, `git/status`.
5. For the agent scene, types the prompt into the real composer and presses Enter. The intercepted `claude/chat` replies with the scripted stream in `fixtures/agent-conversation.mjs`, so the panel renders through the same components as a live run.
6. Deletes every file it created, whatever happens.

The post the agent writes lives in `fixtures/content-agent/` and is installed only while the agent scene runs, so the editor scene shows a blog that has yet to hear about it.

## Options

```bash
node scripts/screenshots/capture.mjs --only=agent --theme=dark
node scripts/screenshots/capture.mjs --headed --keep      # watch it run, keep the fixtures
node scripts/screenshots/capture.mjs --skip-build         # reuse the existing dist/
```

`--out=<dir>`, `--port=<n>` are also available. Run `--headed` when a wait times out: it usually shows the app stuck on a screen the mocks did not cover.

## Changing what is on screen

- **The posts**: edit the MDX under `fixtures/content/`. The frontmatter has to satisfy the `blog` schema in `example/src/content.config.ts`, or the frontmatter form renders empty.
- **The conversation**: edit `fixtures/agent-conversation.mjs`. It is an AI SDK v5 UI message stream, the same shape `POST /astrocms/api/claude/chat` produces; tool parts carry `dynamic: true` and `providerExecuted: true` because Claude Code runs the tools itself. `text()` and `tool()` build the chunks.
- **Keep the exchange short.** The whole thread, user prompt included, has to fit in the panel without scrolling. The script warns when it overflows; shorten the assistant messages or the written file preview until the warning goes away.
- **Layout**: sidebar and agent panel widths come from the `localStorage` keys set in `capture()` (`cms-sidebar-width`, `cms-agent-panel-width`).

## Gotchas

- The script refuses to start if a fixture would overwrite an existing file in `example/src/content/`. Clear the leftover (a previous `--keep` run) first.
- Playwright browsers are not installed by `npm install`. Run `npx playwright install chromium` once if Chromium is missing.
- Anything that depends on the machine, such as the real `git status` count or the Claude account, is mocked. Adding a UI element backed by a new endpoint means adding a mock in `mockRoutes()`, otherwise the capture picks up whatever the local machine happens to return.
