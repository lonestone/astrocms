#!/usr/bin/env node
/**
 * Capture the README screenshots.
 *
 * Runs the real AstroCMS server against `example/`, seeds it with the
 * synthetic blog posts in `fixtures/content/`, then drives the real frontend
 * with Playwright. Only the Claude endpoints and `git status` are intercepted
 * in the browser, so nothing in `packages/astrocms/` knows this script exists.
 *
 *   node scripts/screenshots/capture.mjs [options]
 *
 *   --only=editor|agent   capture a single scene (default: both)
 *   --theme=light|dark    capture a single theme (default: both)
 *   --out=<dir>           output directory (default: docs/screenshots)
 *   --port=<n>            port for the throwaway server (default: 4399)
 *   --headed              show the browser
 *   --keep                leave the fixture content in example/ afterwards
 *   --skip-build          reuse the existing packages/astrocms/dist
 */

import { spawn } from 'node:child_process'
import { chromium } from 'playwright'
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  prompt as agentPrompt,
  streamBody,
  writtenFile,
} from './fixtures/agent-conversation.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const PKG = join(REPO, 'packages', 'astrocms')
const EXAMPLE = join(REPO, 'example')
const CONTENT = join(EXAMPLE, 'src', 'content')
const FIXTURES = join(HERE, 'fixtures')

const args = process.argv.slice(2)
const flag = (name, fallback = null) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
  if (!hit) return fallback
  const eq = hit.indexOf('=')
  return eq < 0 ? true : hit.slice(eq + 1)
}

const only = flag('only')
const themeFilter = flag('theme')
const outDir = resolve(REPO, flag('out', 'docs/screenshots'))
const port = Number(flag('port', 4399))
const headed = Boolean(flag('headed'))
const keepFixtures = Boolean(flag('keep'))
const skipBuild = Boolean(flag('skip-build'))

const VIEWPORT = { width: 1440, height: 900 }
const SCALE = 2
const BASE = `http://127.0.0.1:${port}/astrocms`

const SCENES = [
  {
    name: 'editor',
    file: 'blog/ship-faster-with-mdx/en.mdx',
    agentOpen: false,
    gitFiles: [],
  },
  {
    // The post the scripted agent writes only exists while this scene runs,
    // so the editor scene shows a blog that has yet to hear about it.
    name: 'agent',
    file: writtenFile,
    extraContent: 'content-agent',
    agentOpen: true,
    gitFiles: [
      { status: '?', staged: false, path: `src/content/${writtenFile}` },
    ],
  },
]

const THEMES = ['light', 'dark']

// --- fixture content -------------------------------------------------------

/** Every path this run created under example/, so cleanup touches nothing else. */
const created = new Set()

async function walk(dir, base = dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full, base)))
    else out.push(relative(base, full))
  }
  return out
}

/** Copy one fixture tree into example/src/content. Returns what it created. */
async function installContent(name) {
  const from = join(FIXTURES, name)
  const written = []
  for (const rel of await walk(from)) {
    const dest = join(CONTENT, rel)
    if (existsSync(dest)) {
      throw new Error(
        `Refusing to overwrite existing content: ${relative(REPO, dest)}`
      )
    }
    await mkdir(dirname(dest), { recursive: true })
    await cp(join(from, rel), dest)
    written.push(dest)
    created.add(dest)
  }
  return written
}

/** Duplicate example images under the fixture posts that reference them. */
async function installAssets() {
  const assets = JSON.parse(
    await readFile(join(FIXTURES, 'assets.json'), 'utf-8')
  )
  for (const [dest, src] of Object.entries(assets)) {
    const target = join(CONTENT, dest)
    if (existsSync(target)) continue
    await mkdir(dirname(target), { recursive: true })
    await cp(join(CONTENT, src), target)
    created.add(target)
  }
}

async function removeContent(paths) {
  if (keepFixtures) return
  for (const path of paths) {
    await rm(path, { force: true })
    created.delete(path)
  }
  // Drop the folders the fixtures introduced, if they came out empty.
  for (const dir of new Set(paths.map((p) => dirname(p)))) {
    try {
      if ((await readdir(dir)).length === 0) await rm(dir, { recursive: true })
    } catch {}
  }
}

// --- server ----------------------------------------------------------------

async function buildFrontend() {
  if (skipBuild && existsSync(join(PKG, 'dist', 'index.html'))) return
  console.log('Building the AstroCMS frontend...')
  await run('npm', ['run', 'build'], PKG)
}

function run(cmd, argv, cwd) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, argv, { cwd, stdio: 'inherit' })
    p.on('close', (code) =>
      code === 0 ? res() : rej(new Error(`${cmd} exited with ${code}`))
    )
  })
}

async function startServer() {
  const child = spawn(
    'node',
    ['--import', 'tsx', join(PKG, 'backend', 'server.ts'), '--port', String(port)],
    {
      cwd: EXAMPLE,
      env: {
        ...process.env,
        ASTROCMS_ROOT: EXAMPLE,
        // The screenshots are taken signed out of nothing: no password gate.
        ASTROCMS_PASSWORD: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )
  child.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`))
  child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`))

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/config`)
      if (res.ok) return child
    } catch {}
    await new Promise((r) => setTimeout(r, 300))
  }
  child.kill()
  throw new Error(`Server did not answer on ${BASE} within 60s`)
}

// --- browser ---------------------------------------------------------------

const CLAUDE_STATUS = {
  authenticated: true,
  account: { email: 'editor@example.com', tokenSource: 'oauth' },
}

/** Freeze everything that would otherwise differ between two runs. */
const STILL_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
  }
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
`

async function mockRoutes(context, scene) {
  await context.route('**/api/claude/status*', (route) =>
    route.fulfill({ json: CLAUDE_STATUS })
  )
  await context.route('**/api/claude/conversations*', (route) =>
    route.fulfill({ json: [] })
  )
  await context.route('**/api/claude/permissions/events*', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: '',
    })
  )
  await context.route('**/api/claude/chat*', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'x-vercel-ai-ui-message-stream': 'v1',
      },
      body: streamBody(),
    })
  )
  await context.route('**/api/git/status*', (route) =>
    route.fulfill({ json: { files: scene.gitFiles, remote: null } })
  )
  await context.route('**/api/git/remote-status*', (route) =>
    route.fulfill({ json: null })
  )
}

async function capture(browser, scene, theme) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: theme,
    reducedMotion: 'reduce',
  })

  await context.addInitScript(
    ([theme, agentOpen]) => {
      localStorage.setItem('cms-theme', theme)
      localStorage.setItem('cms-agent-panel-open', String(agentOpen))
      localStorage.setItem('cms-agent-panel-width', '430')
      localStorage.setItem('cms-sidebar-width', '290')
      localStorage.removeItem('cms-agent-session-id')
    },
    [theme, scene.agentOpen]
  )

  await mockRoutes(context, scene)

  const page = await context.newPage()
  await page.goto(`${BASE}/edit/${scene.file}`, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: STILL_CSS })

  // The editor is ready once MDXEditor has rendered the body.
  await page.waitForSelector('.mdxeditor-rich-text', { timeout: 30_000 })
  await page.waitForFunction(
    () =>
      (document.querySelector('.mdxeditor-rich-text')?.textContent ?? '')
        .length > 40,
    { timeout: 30_000 }
  )

  if (scene.name === 'agent') {
    const composer = page.getByPlaceholder(
      'Ask Claude to edit, create or review content'
    )
    await composer.click()
    await composer.fill(agentPrompt)
    await composer.press('Enter')
    // Wait for the last scripted assistant message to land.
    await page
      .getByText('Published', { exact: false })
      .first()
      .waitFor({ timeout: 30_000 })

    // The whole exchange has to fit: once the thread scrolls, the prompt that
    // started it is cut off the top of the capture.
    const overflow = await page.evaluate(() => {
      const el = document.querySelector('aside[aria-label="Agent"] .overflow-y-auto')
      if (!el) return 0
      el.scrollTop = 0
      return el.scrollHeight - el.clientHeight
    })
    // A few pixels of slack come from the thread's bottom spacer, not content.
    if (overflow > 12) {
      console.warn(
        `  the agent thread overflows by ${overflow}px, shorten fixtures/agent-conversation.mjs`
      )
    }
  }

  await page.evaluate(() => document.activeElement?.blur?.())
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  const file = join(outDir, `${scene.name}-${theme}.png`)
  await page.screenshot({ path: file })
  console.log(`  ${relative(REPO, file)}`)

  await context.close()
}

// --- main ------------------------------------------------------------------

let server = null
let browser = null

async function cleanup() {
  await browser?.close().catch(() => {})
  server?.kill()
  await removeContent([...created])
}

process.on('SIGINT', async () => {
  await cleanup()
  process.exit(130)
})

try {
  await mkdir(outDir, { recursive: true })
  await installContent('content')
  await installAssets()
  console.log(`Seeded ${created.size} fixture files into example/src/content`)
  await buildFrontend()
  server = await startServer()

  browser = await chromium.launch({ headless: !headed })

  for (const scene of SCENES) {
    if (only && scene.name !== only) continue
    const extra = scene.extraContent
      ? await installContent(scene.extraContent)
      : []
    for (const theme of THEMES) {
      if (themeFilter && theme !== themeFilter) continue
      console.log(`Capturing ${scene.name} / ${theme}`)
      await capture(browser, scene, theme)
    }
    await removeContent(extra)
  }

  console.log(`Done. ${relative(REPO, outDir)} is up to date.`)
} finally {
  await cleanup()
}
