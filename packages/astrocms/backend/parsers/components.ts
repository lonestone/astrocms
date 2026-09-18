import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { parse } from '@babel/parser'
import type {
  File,
  Identifier,
  Node,
  Statement,
  StringLiteral,
  TSLiteralType,
  TSPropertySignature,
  TSTypeElement,
} from '@babel/types'
import { ROOT_DIR } from '../root.js'
import { loadConfig } from '../config.js'
import { extractRawFrontmatter } from '../../shared/frontmatter.js'

export interface PropSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'json' | 'image'
  optional?: boolean
  options?: string[]
  itemSchema?: PropSchema[]
}

export interface ComponentDescriptor {
  name: string
  props: PropSchema[]
  slots: string[]
}

// Parse the Props declaration of an Astro frontmatter using @babel/parser with
// the TypeScript plugin. Malformed input is caught and yields no props, so this
// function never throws on invalid frontmatter.
export function parseProps(frontmatter: string): PropSchema[] {
  let file: File
  try {
    file = parse(frontmatter, {
      sourceType: 'module',
      plugins: ['typescript'],
      errorRecovery: true,
    })
  } catch {
    return []
  }

  const shapes: ShapeMap = new Map()
  for (const statement of file.program.body) {
    const shape = declaredShape(unwrapExport(statement))
    if (shape) shapes.set(shape.name, shape.members)
  }

  const props = shapes.get('Props')
  if (!props) return []
  return parseMembers(props, shapes, new Set(['Props']))
}

/** Named object shapes declared in the frontmatter, by name. */
type ShapeMap = Map<string, TSTypeElement[]>

/**
 * Members of a named object shape. Astro components declare their props
 * either as `interface Props {}` or as `type Props = {}`; both are indexed
 * so either form works for Props itself and for array element types.
 */
function declaredShape(
  node: Node | null
): { name: string; members: TSTypeElement[] } | null {
  if (node?.type === 'TSInterfaceDeclaration') {
    return { name: node.id.name, members: node.body.body }
  }
  if (
    node?.type === 'TSTypeAliasDeclaration' &&
    node.typeAnnotation.type === 'TSTypeLiteral'
  ) {
    return { name: node.id.name, members: node.typeAnnotation.members }
  }
  return null
}

/**
 * `export interface Props {}` and `export default interface Props {}` wrap the
 * declaration in an export node, unlike a bare `interface Props {}`. Return the
 * declaration in both cases so exported interfaces are indexed too.
 */
function unwrapExport(statement: Statement): Node | null {
  if (
    statement.type === 'ExportNamedDeclaration' ||
    statement.type === 'ExportDefaultDeclaration'
  ) {
    return statement.declaration ?? null
  }
  return statement
}

function isIdentifier(node: Node | null | undefined): node is Identifier {
  return !!node && node.type === 'Identifier'
}

function isPropertySignature(node: Node): node is TSPropertySignature {
  return node.type === 'TSPropertySignature'
}

/**
 * Name of a property signature, or null when it has no static name a form can
 * bind to (a computed key such as `[key]: string`).
 */
function memberName(member: TSPropertySignature): string | null {
  const key = member.key
  if (!member.computed && key.type === 'Identifier') return key.name
  if (key.type === 'StringLiteral') return key.value
  if (key.type === 'NumericLiteral') return String(key.value)
  return null
}

function isStringLiteralType(node: Node): node is TSLiteralType {
  return node.type === 'TSLiteralType' && node.literal.type === 'StringLiteral'
}

/**
 * `expanding` holds the names of the shapes on the current expansion path, so
 * a self-referencing element type such as `interface Item { kids: Item[] }`
 * stops at a plain json field instead of recursing forever.
 */
function parseMembers(
  members: TSTypeElement[],
  shapes: ShapeMap,
  expanding: Set<string>
): PropSchema[] {
  const props: PropSchema[] = []
  for (const member of members.filter(isPropertySignature)) {
    const name = memberName(member)
    if (name === null) continue
    const optional = !!member.optional
    if (member.typeAnnotation) {
      props.push({
        name,
        optional,
        ...resolveType(member.typeAnnotation.typeAnnotation, shapes, expanding),
      })
    } else {
      props.push({ name, type: 'string', optional })
    }
  }
  return props
}

function resolveType(
  typeNode: Node,
  shapes: ShapeMap,
  expanding: Set<string>
): Omit<PropSchema, 'name'> {
  // `readonly T[]` is the array type behind a type operator
  if (typeNode.type === 'TSTypeOperator' && typeNode.operator === 'readonly') {
    return resolveType(typeNode.typeAnnotation, shapes, expanding)
  }

  // String literal union: 'a' | 'b' | 'c'
  if (typeNode.type === 'TSUnionType') {
    const allStringLiterals = typeNode.types.every(isStringLiteralType)
    if (allStringLiterals) {
      const options = typeNode.types.map(
        (t) => ((t as TSLiteralType).literal as StringLiteral).value
      )
      return { type: 'select', options }
    }
  }

  if (
    typeNode.type === 'TSTypeReference' &&
    isIdentifier(typeNode.typeName) &&
    typeNode.typeName.name === 'ImagePath'
  ) {
    return { type: 'image' }
  }

  if (typeNode.type === 'TSStringKeyword') return { type: 'string' }
  if (typeNode.type === 'TSNumberKeyword') return { type: 'number' }
  if (typeNode.type === 'TSBooleanKeyword') return { type: 'boolean' }

  let elementType: Node | undefined
  if (typeNode.type === 'TSArrayType') {
    elementType = typeNode.elementType
  } else if (
    typeNode.type === 'TSTypeReference' &&
    isIdentifier(typeNode.typeName) &&
    typeNode.typeName.name === 'Array' &&
    typeNode.typeArguments?.params.length === 1
  ) {
    elementType = typeNode.typeArguments.params[0]
  }

  if (elementType) {
    // Inline object elements: { label: string }[]
    if (elementType.type === 'TSTypeLiteral') {
      return {
        type: 'json',
        itemSchema: parseMembers(elementType.members, shapes, expanding),
      }
    }
    if (
      elementType.type === 'TSTypeReference' &&
      isIdentifier(elementType.typeName)
    ) {
      const name = elementType.typeName.name
      const members = shapes.get(name)
      if (members && !expanding.has(name)) {
        return {
          type: 'json',
          itemSchema: parseMembers(members, shapes, new Set(expanding).add(name)),
        }
      }
    }
    return { type: 'json' }
  }

  return { type: 'string' }
}

// Parse slot names from an Astro component source.
// Detects <slot> tags in the template and Astro.slots.render/has calls in
// the frontmatter. Empty string "" represents the default (unnamed) slot.
export function parseSlots(source: string): string[] {
  const frontmatter = extractRawFrontmatter(source) ?? ''
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
  const frontmatter = extractRawFrontmatter(source)
  const props = frontmatter ? parseProps(frontmatter) : []
  const slots = parseSlots(source)
  return { props, slots }
}

/** Scan the project's componentsDir and return a descriptor per .astro file. */
export async function scanComponents(): Promise<ComponentDescriptor[]> {
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

  // Wildcard descriptor: catch-all for HTML tags and unknown MDX components
  components.push({ name: '*', props: [], slots: [''] })

  components.sort((a, b) => a.name.localeCompare(b.name))
  return components
}
