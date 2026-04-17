#!/usr/bin/env node

import { execSync, spawn } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgRoot = resolve(__dirname, '..')
const projectRoot = process.env.ASTROCMS_ROOT || process.cwd()
const isDev = process.argv.includes('--dev')

const env = { ...process.env, ASTROCMS_ROOT: projectRoot }

if (isDev) {
  // Dev mode: backend API only (no static serving) + frontend vite dev (HMR)
  const devEnv = { ...env, ASTROCMS_DEV: '1' }

  const server = spawn('npx', ['tsx', 'watch', resolve(pkgRoot, 'backend/server.ts')], {
    cwd: projectRoot,
    env: devEnv,
    stdio: 'inherit',
  })

  const vite = spawn('npx', ['vite', 'dev', '--config', resolve(pkgRoot, 'frontend/vite.config.ts')], {
    cwd: pkgRoot,
    env,
    stdio: 'inherit',
  })

  const cleanup = () => {
    server.kill()
    vite.kill()
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
} else {
  // Production mode: build frontend if needed, then start server
  const distIndex = resolve(pkgRoot, 'dist', 'index.html')
  if (!existsSync(distIndex)) {
    console.log('Building AstroCMS frontend...')
    execSync('npm run build', { cwd: pkgRoot, stdio: 'inherit' })
  }

  console.log(`Starting AstroCMS for project: ${projectRoot}`)
  const server = spawn('node', ['--import', 'tsx', resolve(pkgRoot, 'backend/server.ts')], {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
  })

  server.on('close', (code) => process.exit(code ?? 0))
}
