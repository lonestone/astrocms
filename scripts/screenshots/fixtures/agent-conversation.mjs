/**
 * Scripted agent conversation replayed by the screenshot capture.
 *
 * The chunks below mirror what `POST /astrocms/api/claude/chat` streams in
 * production: an AI SDK v5 UI message stream where every tool call is
 * provider-executed (the Claude Code process runs the tools, so the parts are
 * flagged `dynamic`). Playwright fulfills the request with these chunks, so
 * the panel renders through exactly the same components as a live run.
 *
 * Keep it short enough that the whole exchange, user prompt included, fits in
 * the 900px-tall capture without scrolling.
 */

export const prompt = 'Write a blog post about AstroCMS'

/** Path of the entry the scripted agent writes, relative to the content dir. */
export const writtenFile = 'blog/what-is-astrocms/en.mdx'

const postPath = 'src/content/blog/what-is-astrocms/en.mdx'

const postContent = `---
title: What is AstroCMS?
description: A database-free content editor for Astro sites.
date: 2026-09-04
---

AstroCMS is a content editor for Astro sites that edits the
Markdown and MDX files already in your repository.
`

const chunks = [
  { type: 'start' },
  { type: 'start-step' },

  text('t1', 'Let me check how the blog collection is set up.'),

  ...tool(
    'c1',
    'Glob',
    { pattern: 'src/content/blog/**/*.mdx' },
    [
      'src/content/blog/designing-in-the-browser/en.mdx',
      'src/content/blog/hello-world/en.mdx',
      'src/content/blog/hello-world/fr.mdx',
      'src/content/blog/ship-faster-with-mdx/en.mdx',
      'src/content/blog/why-we-left-our-database/en.mdx',
    ].join('\n')
  ),

  ...tool(
    'c2',
    'Read',
    { file_path: 'src/content.config.ts' },
    `const blog = defineCollection({\n  loader: glob({ pattern: '**/*.mdx', base: 'src/content/blog' }),\n  schema: ({ image }) =>\n    z.object({\n      title: z.string(),\n      description: z.string().optional(),\n      date: z.coerce.date(),\n      image: image().optional(),\n    }),\n})`
  ),

  ...tool(
    'c3',
    'Read',
    { file_path: 'src/content/blog/ship-faster-with-mdx/en.mdx' },
    '---\ntitle: Ship faster with MDX\ndate: 2026-08-21\nimage: ./thumbnail.jpg\n---\n\nOur content used to live in three places at once...'
  ),

  text(
    't2',
    'The schema asks for a **title**, a **date** and an optional **image**. Writing the entry now.'
  ),

  ...tool(
    'c4',
    'Write',
    { file_path: postPath, content: postContent },
    `File created successfully at: ${postPath}`
  ),

  text(
    't3',
    'Published **What is AstroCMS?** at `blog/what-is-astrocms/en.mdx`. Say the word and I will add the French version.'
  ),

  { type: 'finish-step' },
  { type: 'finish' },
].flat()

function text(id, value) {
  return [
    { type: 'text-start', id },
    { type: 'text-delta', id, delta: value },
    { type: 'text-end', id },
  ]
}

function tool(toolCallId, toolName, input, output) {
  return [
    {
      type: 'tool-input-start',
      toolCallId,
      toolName,
      dynamic: true,
      providerExecuted: true,
    },
    {
      type: 'tool-input-available',
      toolCallId,
      toolName,
      input,
      dynamic: true,
      providerExecuted: true,
    },
    {
      type: 'tool-output-available',
      toolCallId,
      output,
      dynamic: true,
      providerExecuted: true,
    },
  ]
}

/** The whole conversation as a single SSE body. */
export function streamBody() {
  return (
    chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') +
    'data: [DONE]\n\n'
  )
}
