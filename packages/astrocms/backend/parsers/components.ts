import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { parse } from '@babel/parser'
import type {
  File,
  Identifier,
  Node,
  StringLiteral,
  TSLiteralType,
  TSInterfaceDeclaration,
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

// Parse interface Props from Astro frontmatter using @babel/parser with the
// TypeScript plugin. Malformed input is caught and yields no props, so this
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

  const interfaces = new Map<string, TSInterfaceDeclaration>()
  for (const node of file.program.body) {
    if (node.type === 'TSInterfaceDeclaration') {
      interfaces.set(node.id.name, node)
    }
  }

  const propsInterface = interfaces.get('Props')
  if (!propsInterface) return []
  return parseMembers(propsInterface, interfaces)
}

function isIdentifier(node: Node | null | undefined): node is Identifier {
  return !!node && node.type === 'Identifier'
}

function isPropertySignature(node: Node): node is TSPropertySignature {
  return node.type === 'TSPropertySignature'
}

function isStringLiteralType(node: Node): node is TSLiteralType {
  return node.type === 'TSLiteralType' && node.literal.type === 'StringLiteral'
}

function parseMembers(
  node: TSInterfaceDeclaration,
  interfaces: Map<string, TSInterfaceDeclaration>
): PropSchema[] {
  const members = node.body.body.filter(isPropertySignature)
  return members.map((member) => {
    const name = isIdentifier(member.key)
      ? member.key.name
      : (member.key as StringLiteral).value
    const optional = !!member.optional
    if (!member.typeAnnotation) {
      return { name, type: 'string' as const, optional }
    }
    return {
      name,
      optional,
      ...resolveType(member.typeAnnotation.typeAnnotation, interfaces),
    }
  })
}

function resolveType(
  typeNode: Node,
  interfaces: Map<string, TSInterfaceDeclaration>
): Omit<PropSchema, 'name'> {
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
    typeNode.typeParameters?.params.length === 1
  ) {
    elementType = typeNode.typeParameters.params[0]
  }

  if (elementType) {
    if (
      elementType.type === 'TSTypeReference' &&
      isIdentifier(elementType.typeName)
    ) {
      const refInterface = interfaces.get(elementType.typeName.name)
      if (refInterface) {
        return {
          type: 'json',
          itemSchema: parseMembers(refInterface, interfaces),
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
