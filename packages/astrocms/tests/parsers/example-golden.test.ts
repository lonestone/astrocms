import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Golden test: runs `scanComponents` against the real example site in this
 * repository (read-only) and pins the descriptors of its components. This
 * catches regressions that synthetic fixtures cannot, e.g. a parser change
 * that only shows up on the actual Button/Header/Section frontmatter.
 */

const exampleRoot = fileURLToPath(new URL('../../../../example', import.meta.url))

// Hand-derived from example/src/components/*.astro:
// - Button.astro: label: string, href?: string, variant?: 'dark' | 'light',
//   no slots in the template or frontmatter.
// - Header.astro: lang?: Lang, where Lang is imported from ../i18n and not
//   declared locally, so it falls back to string. No slots.
// - Section.astro: variant?: 'light' | 'dark', one default <slot /> tag.
const EXPECTED = [
  { name: '*', props: [], slots: [''] },
  {
    name: 'Button',
    props: [
      { name: 'label', type: 'string', optional: false },
      { name: 'href', type: 'string', optional: true },
      { name: 'variant', type: 'select', optional: true, options: ['dark', 'light'] },
    ],
    slots: [],
  },
  {
    name: 'Header',
    props: [{ name: 'lang', type: 'string', optional: true }],
    slots: [],
  },
  {
    name: 'Section',
    props: [
      { name: 'variant', type: 'select', optional: true, options: ['light', 'dark'] },
    ],
    slots: [''],
  },
]

describe('scanComponents golden (example site)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('matches the hand-derived descriptors of the example components', async () => {
    if (!existsSync(join(exampleRoot, 'astrocms.json'))) {
      throw new Error(
        `example/ not found at ${exampleRoot}; run the tests from a repository checkout`
      )
    }

    vi.stubEnv('ASTROCMS_ROOT', exampleRoot)
    vi.resetModules()
    const { scanComponents } = await import('../../backend/parsers/components.js')

    expect(await scanComponents()).toEqual(EXPECTED)
  })
})
