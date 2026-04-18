import { Hono } from 'hono'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import * as ts from 'typescript'
import { ROOT_DIR } from '../root.js'
import { loadConfig } from '../config.js'

interface PropSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'json' | 'image'
  optional?: boolean
  options?: string[]
  itemSchema?: PropSchema[]
}

interface ComponentDescriptor {
  name: string
  props: PropSchema[]
  slots: string[]
}

// Parse interface Props from Astro frontmatter using the TypeScript compiler
function parseProps(frontmatter: string): PropSchema[] {
  const sourceFile = ts.createSourceFile(
    'props.ts',
    frontmatter,
    ts.ScriptTarget.Latest,
    true
  )

  // Collect all interfaces
  const interfaces = new Map<string, ts.InterfaceDeclaration>()
  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node)) {
      interfaces.set(node.name.text, node)
    }
  })

  const propsInterface = interfaces.get('Props')
  if (!propsInterface) return []
  return parseMembers(propsInterface, interfaces)
}

function parseMembers(
  node: ts.InterfaceDeclaration,
  interfaces: Map<string, ts.InterfaceDeclaration>
): PropSchema[] {
  return node.members.filter(ts.isPropertySignature).map((member) => {
    const name = (member.name as ts.Identifier).text
    const optional = !!member.questionToken
    if (!member.type) return { name, type: 'string' as const, optional }
    return { name, optional, ...resolveType(member.type, interfaces) }
  })
}

function resolveType(
  typeNode: ts.TypeNode,
  interfaces: Map<string, ts.InterfaceDeclaration>
): Omit<PropSchema, 'name'> {
  // String literal union: 'a' | 'b' | 'c'
  if (ts.isUnionTypeNode(typeNode)) {
    const allStringLiterals = typeNode.types.every(
      (t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)
    )
    if (allStringLiterals) {
      const options = typeNode.types.map(
        (t) => ((t as ts.LiteralTypeNode).literal as ts.StringLiteral).text
      )
      return { type: 'select', options }
    }
  }

  // ImagePath type alias
  if (
    ts.isTypeReferenceNode(typeNode) &&
    ts.isIdentifier(typeNode.typeName) &&
    typeNode.typeName.text === 'ImagePath'
  ) {
    return { type: 'image' }
  }

  // Primitives
  if (typeNode.kind === ts.SyntaxKind.StringKeyword) return { type: 'string' }
  if (typeNode.kind === ts.SyntaxKind.NumberKeyword) return { type: 'number' }
  if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) return { type: 'boolean' }

  // Array types: Field[] or Array<Field>
  let elementType: ts.TypeNode | undefined
  if (ts.isArrayTypeNode(typeNode)) {
    elementType = typeNode.elementType
  } else if (
    ts.isTypeReferenceNode(typeNode) &&
    ts.isIdentifier(typeNode.typeName) &&
    typeNode.typeName.text === 'Array' &&
    typeNode.typeArguments?.length === 1
  ) {
    elementType = typeNode.typeArguments[0]
  }

  if (elementType) {
    if (
      ts.isTypeReferenceNode(elementType) &&
      ts.isIdentifier(elementType.typeName)
    ) {
      const refInterface = interfaces.get(elementType.typeName.text)
      if (refInterface) {
        return {
          type: 'json',
          itemSchema: parseMembers(refInterface, interfaces),
        }
      }
    }
    return { type: 'json' }
  }

  // Fallback
  return { type: 'string' }
}

// Parse slot names from an Astro component source.
// Detects both <slot> tags in the template and Astro.slots.render/has calls
// in the frontmatter. Empty string "" represents the default (unnamed) slot.
function parseSlots(source: string): string[] {
  const fmMatch = source.match(/^---\n([\s\S]*?)\n---/)
  const frontmatter = fmMatch ? fmMatch[1] : ''
  const parts = source.split('---')
  const template = parts.slice(2).join('---')

  const slots: string[] = []
  const add = (name: string) => {
    const normalized = name === 'default' ? '' : name
    if (!slots.includes(normalized)) slots.push(normalized)
  }

  const tagRe = /<slot([\s/][^>]*)?>/g
  let tagMatch
  while ((tagMatch = tagRe.exec(template)) !== null) {
    const rest = tagMatch[1] || ''
    const nameMatch = rest.match(/name=["']([^"']+)["']/)
    add(nameMatch ? nameMatch[1] : '')
  }

  const apiRe = /Astro\.slots\.(?:render|has)\s*\(\s*["']([^"']+)["']/g
  let apiMatch
  while ((apiMatch = apiRe.exec(frontmatter)) !== null) {
    add(apiMatch[1])
  }

  return slots
}

function parseComponent(source: string): {
  props: PropSchema[]
  slots: string[]
} {
  const fmMatch = source.match(/^---\n([\s\S]*?)\n---/)
  const props = fmMatch ? parseProps(fmMatch[1]) : []
  const slots = parseSlots(source)
  return { props, slots }
}

export const componentsRoutes = new Hono()

componentsRoutes.get('/', async (c) => {
  const components: ComponentDescriptor[] = []

  async function scan(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await scan(join(dir, entry.name))
      } else if (entry.name.endsWith('.astro')) {
        const name = entry.name.replace('.astro', '')
        const source = await readFile(join(dir, entry.name), 'utf-8')
        const { props, slots } = parseComponent(source)
        components.push({ name, props, slots })
      }
    }
  }

  const config = await loadConfig()
  if (config.componentsDir) {
    await scan(join(ROOT_DIR, config.componentsDir))
  }

  // Wildcard descriptor: catch-all for HTML tags (img, section, div, etc.)
  // and any other unknown components used in MDX content
  components.push({
    name: '*',
    props: [],
    slots: [''],
  })

  components.sort((a, b) => a.name.localeCompare(b.name))
  return c.json(components)
})
