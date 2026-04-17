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

const __dirname = dirname(fileURLToPath(import.meta.url))
const config = await loadConfig()

const port = parseInt(process.env.ASTROCMS_PORT || '4001')

const app = new Hono()

app.use('*', cors())

// API routes
app.route('/api/tree', treeRoutes)
app.route('/api/file', fileRoutes)
app.route('/api/git', gitRoutes)
app.route('/api/claude', claudeRoutes)
app.route('/api/upload', uploadRoutes)
app.route('/api/components', componentsRoutes)

// Serve content files (images, media) from the content directory
// URL /content/foo.jpg -> {ROOT_DIR}/{contentDir}/foo.jpg
app.use(
  '/content/*',
  serveStatic({
    root: join(ROOT_DIR, config.contentDir),
    rewriteRequestPath: (path) => path.replace(/^\/content\//, '/'),
  })
)

// Serve static assets from assetsDir if configured
// URL /assets/foo.jpg -> {ROOT_DIR}/{assetsDir}/foo.jpg
if (config.assetsDir) {
  app.use(
    '/assets/*',
    serveStatic({
      root: join(ROOT_DIR, config.assetsDir),
      rewriteRequestPath: (path) => path.replace(/^\/assets\//, '/'),
    })
  )
}

const isDev = process.env.ASTROCMS_DEV === '1'

if (!isDev) {
  // Serve CMS frontend (built files in dist/)
  app.use('/*', serveStatic({ root: join(__dirname, '..', 'dist') }))

  // SPA fallback: serve index.html for all non-matched routes
  app.get('*', serveStatic({ root: join(__dirname, '..', 'dist'), path: 'index.html' }))
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
    console.log(`AstroCMS running on http://localhost:${port}`)
    console.log(`Project root: ${ROOT_DIR}`)
  })
}

tryListen(requestedPort)
