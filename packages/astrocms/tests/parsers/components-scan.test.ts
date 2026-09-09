import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Integration tests for `scanComponents`: walks a real (temporary) project
 * root, reads astrocms.json and parses every .astro file.
 *
 * `ROOT_DIR` is resolved from ASTROCMS_ROOT at module import time and
 * `loadConfig()` caches per module instance, so each test points the env var
 * at its own fixture root and re-imports the module via vi.resetModules().
 */

const A_ASTRO = [
  '---',
  'interface Props {',
  '  title: string',
  "  variant?: 'dark' | 'light'",
  '}',
  '---',
  '<section><slot /></section>',
].join('\n') + '\n'

const B_ASTRO = [
  '---',
  'interface Item { label: string }',
  'interface Props { items: Item[] }',
  '---',
  '<div><slot name="footer" /></div>',
].join('\n') + '\n'

const C_FIRST_ASTRO = '---\ninterface Props { a: string }\n---\n<p>a</p>\n'
const C_SECOND_ASTRO = '---\ninterface Props { b: number }\n---\n<p>b</p>\n'

const A_DESCRIPTOR = {
  name: 'A',
  props: [
    { name: 'title', type: 'string', optional: false },
    { name: 'variant', type: 'select', optional: true, options: ['dark', 'light'] },
  ],
  slots: [''],
}

const B_DESCRIPTOR = {
  name: 'B',
  props: [
    {
      name: 'items',
      type: 'json',
      optional: false,
      itemSchema: [{ name: 'label', type: 'string', optional: false }],
    },
  ],
  slots: ['footer'],
}

const WILDCARD = { name: '*', props: [], slots: [''] }

/** Main fixture tree shared by C1 to C4. */
const MAIN_FILES: Record<string, string> = {
  'astrocms.json': JSON.stringify({ componentsDir: 'src/components' }),
  'src/components/A.astro': A_ASTRO,
  'src/components/sub/B.astro': B_ASTRO,
  'src/components/notes.txt': 'not a component',
}

async function makeRoot(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'astrocms-scan-'))
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content, 'utf-8')
  }
  return root
}

async function scanIn(root: string) {
  vi.stubEnv('ASTROCMS_ROOT', root)
  vi.resetModules()
  const { scanComponents } = await import('../../backend/parsers/components.js')
  return scanComponents()
}

const createdRoots: string[] = []

beforeEach(() => {
  // Keep the suite hermetic against a developer's own environment.
  vi.stubEnv('ASTROCMS_COMPONENTS_DIR', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

afterAll(async () => {
  await Promise.all(createdRoots.map((r) => rm(r, { recursive: true, force: true })))
})

describe('scanComponents', () => {
  it('C1: recurses into subdirectories and only reads .astro files', async () => {
    const root = await makeRoot(MAIN_FILES)
    createdRoots.push(root)

    const components = await scanIn(root)
    const names = components.map((c) => c.name)

    expect(names).toContain('A')
    expect(names).toContain('B')
    expect(names).not.toContain('notes.txt')
  })

  it('C2: descriptors match the unit-tested parseProps/parseSlots output', async () => {
    const root = await makeRoot(MAIN_FILES)
    createdRoots.push(root)

    const components = await scanIn(root)

    expect(components).toContainEqual(A_DESCRIPTOR)
    expect(components).toContainEqual(B_DESCRIPTOR)
  })

  it('C3: always appends the wildcard descriptor', async () => {
    const root = await makeRoot(MAIN_FILES)
    createdRoots.push(root)

    const components = await scanIn(root)

    expect(components).toContainEqual(WILDCARD)
  })

  it('C4: results are sorted by localeCompare', async () => {
    const root = await makeRoot(MAIN_FILES)
    createdRoots.push(root)

    const components = await scanIn(root)
    const names = components.map((c) => c.name)

    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names)
  })

  it('C5: astrocms.json without componentsDir yields only the wildcard', async () => {
    const root = await makeRoot({
      'astrocms.json': JSON.stringify({ contentDir: 'src/content' }),
    })
    createdRoots.push(root)

    const components = await scanIn(root)

    expect(components).toEqual([WILDCARD])
  })

  it('C6: missing astrocms.json yields only the wildcard', async () => {
    const root = await makeRoot({})
    createdRoots.push(root)

    const components = await scanIn(root)

    expect(components).toEqual([WILDCARD])
  })

  it('C7: component name is the basename without extension or path', async () => {
    const root = await makeRoot(MAIN_FILES)
    createdRoots.push(root)

    const components = await scanIn(root)

    expect(components.some((c) => c.name === 'B')).toBe(true)
    expect(components.some((c) => c.name === 'sub/B')).toBe(false)
  })

  it('C8: name collisions across subdirectories are both kept (characterization)', async () => {
    const root = await makeRoot({
      'astrocms.json': JSON.stringify({ componentsDir: 'src/components' }),
      'src/components/sub1/C.astro': C_FIRST_ASTRO,
      'src/components/sub2/C.astro': C_SECOND_ASTRO,
    })
    createdRoots.push(root)

    const components = await scanIn(root)
    const collisions = components.filter((c) => c.name === 'C')

    expect(collisions).toHaveLength(2)
    expect(components).toContainEqual({
      name: 'C',
      props: [{ name: 'a', type: 'string', optional: false }],
      slots: [],
    })
    expect(components).toContainEqual({
      name: 'C',
      props: [{ name: 'b', type: 'number', optional: false }],
      slots: [],
    })
  })
})
