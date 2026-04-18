import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createJiti } from 'jiti'
import { z } from 'zod'
import { ROOT_DIR } from '../root.js'
import { loadConfig } from '../config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface FrontmatterFieldSchema {
  name: string
  type:
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'json'
    | 'image'
    | 'date'
    | 'string-array'
    | 'object'
  required?: boolean
  options?: string[]
  itemSchema?: FrontmatterFieldSchema[]
  children?: FrontmatterFieldSchema[]
}

// Sentinel symbol to identify image() fields
const IMAGE_MARKER = Symbol('image')

/**
 * Load content.config.ts at runtime using jiti, with mocked Astro modules.
 * Then introspect the Zod schemas to extract field definitions.
 */
export async function parseContentSchemas(): Promise<
  Record<string, FrontmatterFieldSchema[]>
> {
  const config = await loadConfig()
  const configPath = join(ROOT_DIR, config.contentConfig)

  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
    alias: {
      'astro:content': join(__dirname, '../stubs/astro-content.ts'),
      'astro/zod': 'zod',
    },
  })

  // Clear the module from jiti cache to pick up changes
  const mod = (await jiti.import(configPath)) as {
    collections: Record<string, { schema: unknown }>
  }

  const result: Record<string, FrontmatterFieldSchema[]> = {}

  for (const [name, collection] of Object.entries(mod.collections)) {
    const { schema } = collection
    if (!schema) continue

    // schema can be a z.object directly, or a function ({ image }) => z.object(...)
    let zodSchema: z.ZodObject<z.ZodRawShape>
    if (typeof schema === 'function') {
      zodSchema = schema({
        image: () => {
          const s = z.string()
          ;(s as any)[IMAGE_MARKER] = true
          return s
        },
      })
    } else if (schema instanceof z.ZodObject) {
      zodSchema = schema
    } else {
      continue
    }

    if (!(zodSchema instanceof z.ZodObject)) continue
    result[name] = parseZodShape(zodSchema)
  }

  return result
}

function parseZodShape(
  schema: z.ZodObject<z.ZodRawShape>
): FrontmatterFieldSchema[] {
  const fields: FrontmatterFieldSchema[] = []
  const shape = schema.shape

  for (const [name, fieldSchema] of Object.entries(shape)) {
    const field = resolveZodField(name, fieldSchema as z.ZodTypeAny)
    if (field) fields.push(field)
  }

  return fields
}

function resolveZodField(
  name: string,
  schema: z.ZodTypeAny
): FrontmatterFieldSchema | undefined {
  let required = true
  let inner = schema

  // Unwrap ZodOptional
  if (inner instanceof z.ZodOptional) {
    required = false
    inner = inner.unwrap()
  }

  // Unwrap ZodDefault
  if (inner instanceof z.ZodDefault) {
    required = false
    inner = inner._def.innerType
  }

  // Image sentinel
  if ((inner as any)[IMAGE_MARKER]) {
    return { name, type: 'image', required }
  }

  // z.string()
  if (inner instanceof z.ZodString) {
    return { name, type: 'string', required }
  }

  // z.number()
  if (inner instanceof z.ZodNumber) {
    return { name, type: 'number', required }
  }

  // z.boolean()
  if (inner instanceof z.ZodBoolean) {
    return { name, type: 'boolean', required }
  }

  // z.date() or z.coerce.date()
  if (inner instanceof z.ZodDate) {
    return { name, type: 'date', required }
  }

  // z.enum([...])
  if (inner instanceof z.ZodEnum) {
    return { name, type: 'select', required, options: inner.options }
  }

  // z.object(...)
  if (inner instanceof z.ZodObject) {
    return {
      name,
      type: 'object',
      required,
      children: parseZodShape(inner as z.ZodObject<z.ZodRawShape>),
    }
  }

  // z.array(...)
  if (inner instanceof z.ZodArray) {
    const element = unwrapOptional(inner.element)
    if (element instanceof z.ZodString || element instanceof z.ZodUnion) {
      return { name, type: 'string-array', required }
    }
    if (element instanceof z.ZodObject) {
      return {
        name,
        type: 'json',
        required,
        itemSchema: parseZodShape(element as z.ZodObject<z.ZodRawShape>),
      }
    }
    return { name, type: 'json', required }
  }

  return { name, type: 'string', required }
}

function unwrapOptional(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional) return schema.unwrap()
  if (schema instanceof z.ZodDefault) return schema._def.innerType
  return schema
}
