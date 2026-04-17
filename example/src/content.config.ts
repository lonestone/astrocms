import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const blog = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: 'src/content/blog' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      image: image().optional(),
    }),
})

const pages = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: 'src/content/pages' }),
  schema: z.object({
    title: z.string(),
  }),
})

const translations = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: 'src/content/translations' }),
})

export const collections = { blog, pages, translations }
