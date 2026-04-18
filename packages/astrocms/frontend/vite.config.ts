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
      '/astrocms/api': 'http://localhost:4001',
      '/astrocms/content': 'http://localhost:4001',
      '/astrocms/assets': 'http://localhost:4001',
    },
  },
})
