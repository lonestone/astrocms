import { describe, expect, it } from 'vitest'
import {
  parseProps,
  parseSlots,
} from '../../backend/parsers/components.js'

/**
 * Contract and characterization tests for the component parser functions:
 *
 * - `parseProps` uses @babel/parser with the TypeScript plugin at runtime to
 *   read `interface Props` from frontmatter.
 * - `parseSlots` detects `<slot>` tags in the template and
 *   `Astro.slots.render/has` calls in the frontmatter via regex.
 *
 * These tests pin the observable behavior of the parser so engine swaps do
 * not cause regressions. The original implementation used the TypeScript JS
 * compiler API, which is not available in TypeScript 7; the tests never
 * import a parser engine directly: only the exported contract matters.
 */

const cases = [
  // P1: empty frontmatter yields no props
  { id: 'P1', fm: '', expected: [] },

  // P2: frontmatter without any interface yields no props
  { id: 'P2', fm: 'const x = 1', expected: [] },

  // P3: only interfaces with a different name are ignored
  { id: 'P3', fm: 'interface Foo { a: string }', expected: [] },

  // P4: minimal required prop
  {
    id: 'P4',
    fm: 'interface Props { title: string }',
    expected: [{ name: 'title', type: 'string', optional: false }],
  },

  // P5: optional prop via `?`
  {
    id: 'P5',
    fm: 'interface Props { title?: string }',
    expected: [{ name: 'title', type: 'string', optional: true }],
  },

  // P6: number and boolean keywords map to their schema types
  {
    id: 'P6',
    fm: 'interface Props { count: number; active: boolean }',
    expected: [
      { name: 'count', type: 'number', optional: false },
      { name: 'active', type: 'boolean', optional: false },
    ],
  },

  // P7: all-string-literal union becomes a select, option order preserved
  {
    id: 'P7',
    fm: "interface Props { variant?: 'dark' | 'light' }",
    expected: [
      { name: 'variant', type: 'select', optional: true, options: ['dark', 'light'] },
    ],
  },

  // P8: mixed union (not all string literals) falls back to string
  {
    id: 'P8',
    fm: 'interface Props { x: string | number }',
    expected: [{ name: 'x', type: 'string', optional: false }],
  },

  // P9: ImagePath type reference becomes image
  {
    id: 'P9',
    fm: 'interface Props { cover: ImagePath }',
    expected: [{ name: 'cover', type: 'image', optional: false }],
  },

  // P10: array of a locally declared interface becomes json with itemSchema
  {
    id: 'P10',
    fm: [
      'interface Item { label: string; count?: number }',
      'interface Props { items: Item[] }',
    ].join('\n'),
    expected: [
      {
        name: 'items',
        type: 'json',
        optional: false,
        itemSchema: [
          { name: 'label', type: 'string', optional: false },
          { name: 'count', type: 'number', optional: true },
        ],
      },
    ],
  },

  // P11: Array<T> syntax is equivalent to T[]
  {
    id: 'P11',
    fm: [
      'interface Item { label: string; count?: number }',
      'interface Props { items: Array<Item> }',
    ].join('\n'),
    expected: [
      {
        name: 'items',
        type: 'json',
        optional: false,
        itemSchema: [
          { name: 'label', type: 'string', optional: false },
          { name: 'count', type: 'number', optional: true },
        ],
      },
    ],
  },

  // P12: array of primitives becomes json without itemSchema
  {
    id: 'P12',
    fm: 'interface Props { tags: string[] }',
    expected: [{ name: 'tags', type: 'json', optional: false }],
  },

  // P13: array of a reference that is not declared locally becomes json
  {
    id: 'P13',
    fm: 'interface Props { items: Unknown[] }',
    expected: [{ name: 'items', type: 'json', optional: false }],
  },

  // P14: reference to an externally imported type falls back to string
  {
    id: 'P14',
    fm: 'interface Props { lang?: Lang }',
    expected: [{ name: 'lang', type: 'string', optional: true }],
  },

  // P15 (characterization): property without a type annotation falls back to
  // string. Pins Babel's errorRecovery behavior for this input.
  {
    id: 'P15',
    fm: 'interface Props { foo; }',
    expected: [{ name: 'foo', type: 'string', optional: false }],
  },

  // P16 (characterization): quoted property names are unwrapped via the
  // StringLiteral text
  {
    id: 'P16',
    fm: 'interface Props { "foo-bar": string }',
    expected: [{ name: 'foo-bar', type: 'string', optional: false }],
  },

  // P17: readonly modifier does not change the result, prop is included
  {
    id: 'P17',
    fm: 'interface Props { readonly title: string }',
    expected: [{ name: 'title', type: 'string', optional: false }],
  },

  // P18: method signatures are skipped, only property signatures count
  {
    id: 'P18',
    fm: 'interface Props { title: string; getLabel(): string }',
    expected: [{ name: 'title', type: 'string', optional: false }],
  },

  // P19 (characterization): members inherited via `extends` are not included,
  // only the declared members of Props itself
  {
    id: 'P19',
    fm: [
      'interface Base { a: string }',
      'interface Props extends Base { b: number }',
    ].join('\n'),
    expected: [{ name: 'b', type: 'number', optional: false }],
  },

  // P20: a type alias named Props is not an interface declaration
  { id: 'P20', fm: 'type Props = { a: string }', expected: [] },

  // P21 (characterization): invalid TS must not throw. Babel rejects `a:`
  // without a type even with errorRecovery, so parseProps catches the error
  // and returns no props (the TS compiler used to recover this best-effort).
  {
    id: 'P21',
    fm: 'interface Props { a: }',
    expected: [],
  },

  // P22: CRLF line endings behave like LF
  {
    id: 'P22',
    fm: 'interface Props {\r\n  title: string\r\n}',
    expected: [{ name: 'title', type: 'string', optional: false }],
  },

  // P23: `export interface Props` is as valid as the bare form. Astro itself
  // ships components written this way, and the type has to be exported to be
  // importable from another file.
  {
    id: 'P23',
    fm: 'export interface Props { title: string; count?: number }',
    expected: [
      { name: 'title', type: 'string', optional: false },
      { name: 'count', type: 'number', optional: true },
    ],
  },

  // P24: an exported interface is also resolvable as an array element type
  {
    id: 'P24',
    fm: [
      'export interface Item { label: string }',
      'export interface Props { items: Item[] }',
    ].join('\n'),
    expected: [
      {
        name: 'items',
        type: 'json',
        optional: false,
        itemSchema: [{ name: 'label', type: 'string', optional: false }],
      },
    ],
  },

  // P25: `export default interface Props` wraps the declaration too
  {
    id: 'P25',
    fm: 'export default interface Props { a: string }',
    expected: [{ name: 'a', type: 'string', optional: false }],
  },

  // P26: a numeric property name is exposed as a string, like every other name
  {
    id: 'P26',
    fm: 'interface Props { 1: string }',
    expected: [{ name: '1', type: 'string', optional: false }],
  },

  // P27: a computed key has no static name to bind a form field to, so it is
  // skipped and the other members are still parsed
  {
    id: 'P27',
    fm: "const k = 'a'\ninterface Props { [k]: string; b: number }",
    expected: [{ name: 'b', type: 'number', optional: false }],
  },
]

describe('parseProps', () => {
  it.each(cases)('$id: maps frontmatter to the expected PropSchema list', ({ fm, expected }) => {
    expect(parseProps(fm)).toEqual(expected)
  })

  it('P21: never throws on invalid TypeScript', () => {
    expect(() => parseProps('interface Props { a: }')).not.toThrow()
  })
})

/**
 * Slot cases. Each source is a full `.astro` document (frontmatter + template).
 * The empty string `''` represents the default (unnamed) slot.
 */
describe('parseSlots', () => {
  // S1: no frontmatter, no slot tag
  it('S1: plain template without slots yields an empty list', () => {
    expect(parseSlots('<div>hi</div>')).toEqual([])
  })

  // S2: default slot tag in the template
  it('S2: <slot /> yields the default slot', () => {
    const source = '---\ninterface Props {}\n---\n<slot />\n'
    expect(parseSlots(source)).toEqual([''])
  })

  // S3: named slot tag
  it('S3: <slot name="footer" /> yields the named slot', () => {
    const source = '---\ninterface Props {}\n---\n<slot name="footer" />\n'
    expect(parseSlots(source)).toEqual(['footer'])
  })

  // S4: duplicates are dropped, order of first occurrence is kept
  it('S4: dedupes slots and keeps first-occurrence order', () => {
    const source =
      '---\ninterface Props {}\n---\n<slot name="a" /><slot /><slot name="a" />\n'
    expect(parseSlots(source)).toEqual(['a', ''])
  })

  // S5: Astro.slots.render in the frontmatter, no tag in the template
  it('S5: Astro.slots.render in frontmatter is detected', () => {
    const source = "---\nconst out = Astro.slots.render('footer')\n---\n<div>hi</div>\n"
    expect(parseSlots(source)).toEqual(['footer'])
  })

  // S6: Astro.slots.has in the frontmatter
  it('S6: Astro.slots.has in frontmatter is detected', () => {
    const source = "---\nconst has = Astro.slots.has('header')\n---\n<div>hi</div>\n"
    expect(parseSlots(source)).toEqual(['header'])
  })

  // S7: 'default' is normalized to '' and deduped against <slot />
  it('S7: render(\'default\') normalizes to the default slot', () => {
    const source = "---\nAstro.slots.render('default')\n---\n<slot />\n"
    expect(parseSlots(source)).toEqual([''])
  })

  // S8: template slots come first, then frontmatter API calls
  it('S8: template slots are listed before frontmatter API calls', () => {
    const source = "---\nAstro.slots.render('a')\n---\n<slot name=\"b\" />\n"
    expect(parseSlots(source)).toEqual(['b', 'a'])
  })

  // S9: a slot tag string inside the frontmatter is ignored
  it('S9: <slot> tags in the frontmatter are ignored', () => {
    const source = "---\nconst s = '<slot name=\"x\" />'\n---\n<div>hi</div>\n"
    expect(parseSlots(source)).toEqual([])
  })

  // S10: Astro.slots.render in the template is ignored (no tag present)
  it('S10: Astro.slots calls in the template are ignored', () => {
    const source = "---\nconst a = 1\n---\n{Astro.slots.render('x')}\n"
    expect(parseSlots(source)).toEqual([])
  })

  // S11a: double-quoted API call in the frontmatter
  it('S11a: double quotes work for Astro.slots.render', () => {
    const source = '---\nAstro.slots.render("footer")\n---\n<div>hi</div>\n'
    expect(parseSlots(source)).toEqual(['footer'])
  })

  // S11b: closed slot tag in the template (opening tag is what matches)
  it('S11b: closed <slot name="x">...</slot> tags are detected', () => {
    const source = '---\ninterface Props {}\n---\n<slot name="x">content</slot>\n'
    expect(parseSlots(source)).toEqual(['x'])
  })

  // S12: slot tag with attributes but no name counts as the default slot
  it('S12: <slot {...rest} /> without a name yields the default slot', () => {
    const source = '---\ninterface Props {}\n---\n<slot {...rest} />\n'
    expect(parseSlots(source)).toEqual([''])
  })

  // S13 (characterization): a `---` line inside the frontmatter truncates
  // extractRawFrontmatter at the first fence, so an API call after it is
  // missed. Slot tags in the real template are still found because the split
  // rejoins everything after the second `---`. Pins current behavior.
  it('S13: a --- line inside frontmatter hides later API calls', () => {
    const source =
      [
        '---',
        'const note = `',
        '---',
        '`',
        "Astro.slots.render('x')",
        '---',
        '<slot name="y" />',
      ].join('\n') + '\n'
    expect(parseSlots(source)).toEqual(['y'])
  })
})
