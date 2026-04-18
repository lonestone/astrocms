import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { ROOT_DIR } from './root.js'
import { loadConfig } from './config.js'
import { treeRoutes } from './routes/tree.js'
import { fileRoutes } from './routes/file.js'
import { gitRoutes } from './routes/git.js'
import { claudeRoutes } from './routes/claude.js'
import { uploadRoutes } from './routes/upload.js'
import { componentsRoutes } from './routes/components.js'
import { configRoutes } from './routes/config.js'
import { authRoutes } from './routes/auth.js'
import { authMiddleware } from './auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = await loadConfig()

function parsePortArg(argv: string[]): number | null {
  const i = argv.indexOf('--port')
  if (i >= 0 && argv[i + 1]) return parseInt(argv[i + 1])
  const eq = argv.find((a) => a.startsWith('--port='))
  if (eq) return parseInt(eq.slice('--port='.length))
  return null
}

const port = parsePortArg(process.argv) ?? 4001

const CMS_PREFIX = '/astrocms'
const devPort = process.env.ASTROCMS_DEV_PORT

// Vite may bind to either IPv4 (127.0.0.1) or IPv6 (::1) depending on the
// host OS resolution of "localhost". Try both and remember which one answered.
let preferredDevHost: string | null = null
function devHostCandidates(): string[] {
  if (preferredDevHost) return [preferredDevHost]
  return ['127.0.0.1', '[::1]']
}

const app = new Hono()
app.use('*', cors())

const cms = new Hono()

cms.use('/api/*', authMiddleware)
cms.route('/api/auth', authRoutes)

cms.route('/api/tree', treeRoutes)
cms.route('/api/file', fileRoutes)
cms.route('/api/git', gitRoutes)
cms.route('/api/claude', claudeRoutes)
cms.route('/api/upload', uploadRoutes)
cms.route('/api/components', componentsRoutes)
cms.route('/api/config', configRoutes)

// Serve content files (images, media) from the content directory
// URL /astrocms/content/foo.jpg -> {ROOT_DIR}/{contentDir}/foo.jpg
cms.use('/content/*', authMiddleware)
cms.use(
  '/content/*',
  serveStatic({
    root: join(ROOT_DIR, config.contentDir),
    rewriteRequestPath: (path) =>
      path.replace(new RegExp(`^${CMS_PREFIX}/content/`), '/'),
  })
)

// Serve static assets from assetsDir if configured
// URL /astrocms/assets/foo.jpg -> {ROOT_DIR}/{assetsDir}/foo.jpg
if (config.assetsDir) {
  cms.use('/assets/*', authMiddleware)
  cms.use(
    '/assets/*',
    serveStatic({
      root: join(ROOT_DIR, config.assetsDir),
      rewriteRequestPath: (path) =>
        path.replace(new RegExp(`^${CMS_PREFIX}/assets/`), '/'),
    })
  )
}

const isDev = process.env.ASTROCMS_DEV === '1'

if (!isDev) {
  // Serve CMS frontend (built files in dist/) scoped under /astrocms
  cms.use(
    '/*',
    serveStatic({
      root: join(__dirname, '..', 'dist'),
      rewriteRequestPath: (path) =>
        path.replace(new RegExp(`^${CMS_PREFIX}`), '') || '/',
    })
  )

  // SPA fallback: serve index.html for all non-matched CMS routes
  cms.get(
    '*',
    serveStatic({ root: join(__dirname, '..', 'dist'), path: 'index.html' })
  )
}

app.route(CMS_PREFIX, cms)

if (devPort) {
  // Pass-through proxy to the website dev server for any path outside /astrocms
  app.all('*', async (c) => {
    const incoming = new URL(c.req.url)
    const pathAndQuery = incoming.pathname + incoming.search
    const headers = new Headers(c.req.raw.headers)
    headers.delete('host')
    const init: RequestInit & { duplex?: 'half' } = {
      method: c.req.method,
      headers,
      redirect: 'manual',
    }
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      init.body = c.req.raw.body as any
      init.duplex = 'half'
    }
    let lastErr: unknown
    for (const host of devHostCandidates()) {
      try {
        const res = await fetch(
          `http://${host}:${devPort}${pathAndQuery}`,
          init
        )
        preferredDevHost = host
        const respHeaders = new Headers(res.headers)
        respHeaders.delete('content-encoding')
        respHeaders.delete('content-length')
        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers: respHeaders,
        })
      } catch (err) {
        lastErr = err
      }
    }
    const msg = (lastErr as any)?.message ?? String(lastErr)
    return c.text(`Dev server unavailable on port ${devPort}: ${msg}`, 502)
  })
} else {
  app.get('/', (c) => c.redirect(`${CMS_PREFIX}/`))
}

const requestedPort = port

function tryListen(port: number, maxAttempts = 10): void {
  const server = serve({ fetch: app.fetch, port })
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && maxAttempts > 1) {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`)
      tryListen(port + 1, maxAttempts - 1)
    } else {
      throw err
    }
  })
  server.on('listening', () => {
    console.log(`AstroCMS running on http://localhost:${port}${CMS_PREFIX}`)
    console.log(`Project root: ${ROOT_DIR}`)
    if (devPort) {
      console.log(`Proxying root to dev server on port ${devPort}`)
    }
  })
}

tryListen(requestedPort)
