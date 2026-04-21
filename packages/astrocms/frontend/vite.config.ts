import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: __dirname,
  base: '/astrocms/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: '_cms',
  },
  server: {
    port: 4002,
    proxy: {
      // Use regex so any /astrocms/(api|content|assets)/* path is proxied,
      // independent of how Vite normalizes the request path internally. A
      // plain prefix pattern can end up shadowed by Vite's SPA fallback for
      // certain routes, which returns index.html instead of the API JSON.
      '^/astrocms/(api|content|assets)(/|$)': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
})
