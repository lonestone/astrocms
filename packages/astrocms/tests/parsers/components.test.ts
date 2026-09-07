import { describe, expect, it } from 'vitest'
import { parseProps } from '../../backend/parsers/components.js'

/**
 * Contract and characterization tests for `parseProps`, the function that uses
 * the TypeScript JS compiler API at runtime (ts.createSourceFile & co.).
 *
 * These tests pin the observable behavior of the current implementation so the
 * parser can later be swapped for a different engine (e.g. after moving to
 * TypeScript 7, which no longer ships the JS compiler API) without regressions.
 * They never import `typescript` directly: only the exported contract matters.
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
  // string. Pins the error-recovery shape of createSourceFile.
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

  // P21 (characterization): invalid TS is recovered best-effort by the parser
  // and must not throw. Pins the current recovery result for `a:` without type.
  {
    id: 'P21',
    fm: 'interface Props { a: }',
    expected: [{ name: 'a', type: 'string', optional: false }],
  },

  // P22: CRLF line endings behave like LF
  {
    id: 'P22',
    fm: 'interface Props {\r\n  title: string\r\n}',
    expected: [{ name: 'title', type: 'string', optional: false }],
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
