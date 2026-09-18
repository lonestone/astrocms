import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import { unified } from '@astrojs/markdown-remark'
import tailwindcss from '@tailwindcss/vite'
import rehypeMdClass from './src/rehype-md-class'
import config from './website.config'

export default defineConfig({
  site: config.site,
  integrations: [mdx()],
  markdown: {
    processor: unified({
      rehypePlugins: [rehypeMdClass],
    }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: config.defaultLang,
    locales: [...config.langs],
    routing: {
      prefixDefaultLocale: true,
    },
  },
})
