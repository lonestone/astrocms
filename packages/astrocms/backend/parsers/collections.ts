import { join, dirname, relative, resolve } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'node:module'
import { createJiti } from 'jiti'
import { z } from 'zod'
import { ROOT_DIR } from '../root.js'
import { loadConfig } from '../config.js'
import { matchGlob } from './glob.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Absolute path to AstroCMS's own zod so user configs that `import 'zod'`
// can resolve even when the user project doesn't depend on zod directly.
const ZOD_PATH = createRequire(import.meta.url).resolve('zod')

export interface FrontmatterFieldSchema {
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

export interface CollectionInfo {
  schema: FrontmatterFieldSchema[] | null
  /** Kind of loader declared in content.config.ts. */
  loader?: 'glob' | 'file'
  /** Glob pattern from the loader (glob kind only). Relative to `base`. */
  pattern?: string | string[]
  /**
   * Loader base, made relative to the CMS `contentDir`. For a typical Astro
   * project this matches the collection folder name (e.g. `blog`). Undefined
   * if the loader has no `base` or if `base` is outside the content dir.
   */
  base?: string
  /**
   * For `file` loader: path to the single data file, relative to `contentDir`.
   * The whole file holds a dict of entries keyed by id; the schema describes
   * one entry, not the file as a whole.
   */
  filePath?: string
}

let cache:
  | { collections: Record<string, CollectionInfo>; error?: string }
  | undefined

/** Cached collections info (parsed once per server run). */
export async function getCollections(): Promise<{
  collections: Record<string, CollectionInfo>
  error?: string
}> {
  if (!cache) {
    try {
      cache = { collections: await parseCollections() }
    } catch (err) {
      console.error('[astrocms] Failed to parse content.config.ts:', err)
      cache = {
        collections: {},
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
  return cache
}

/**
 * Return the collection a file belongs to based on path + glob pattern.
 * Falls back to first-segment match when the collection has no loader info.
 */
export function resolveCollection(
  filePath: string,
  collections: Record<string, CollectionInfo>
): string | undefined {
  for (const [name, info] of Object.entries(collections)) {
    if (info.loader === 'file' && info.filePath) {
      if (filePath === info.filePath) return name
    } else if (info.base !== undefined && info.pattern !== undefined) {
      const prefix = info.base ? info.base + '/' : ''
      if (info.base && !filePath.startsWith(prefix)) continue
      const rel = info.base ? filePath.slice(prefix.length) : filePath
      if (matchGlob(rel, info.pattern)) return name
    } else if (filePath.split('/')[0] === name) {
      return name
    }
  }
  return undefined
}

// Sentinel symbol to identify image() fields
const IMAGE_MARKER = Symbol('image')

interface RawLoader {
  __kind?: 'glob' | 'file'
  pattern?: string | string[]
  base?: string
  path?: string
}

/**
 * Load content.config.ts at runtime using jiti, with mocked Astro modules.
 * Then introspect the Zod schemas and the loader args to build CollectionInfo.
 */
async function parseCollections(): Promise<Record<string, CollectionInfo>> {
  const config = await loadConfig()
  const configPath = join(ROOT_DIR, config.contentConfig)
  const contentDirAbs = resolve(ROOT_DIR, config.contentDir)

  const jiti = createJiti(import.meta.url, {
    moduleCache: false,
    alias: {
      'astro:content': join(__dirname, '../stubs/astro-content.ts'),
      'astro/loaders': join(__dirname, '../stubs/astro-loaders.ts'),
      'astro/zod': ZOD_PATH,
      zod: ZOD_PATH,
    },
  })

  const mod = (await jiti.import(configPath)) as {
    collections: Record<string, { schema?: unknown; loader?: RawLoader }>
  }

  const result: Record<string, CollectionInfo> = {}

  for (const [name, collection] of Object.entries(mod.collections)) {
    const info: CollectionInfo = { schema: null }

    // Loader: capture kind and the relevant args (relative to contentDir).
    const loader = collection.loader
    if (loader && typeof loader === 'object') {
      if (loader.__kind === 'glob' || loader.__kind === 'file') {
        info.loader = loader.__kind
      }
      if (loader.__kind === 'glob') {
        if (loader.pattern !== undefined) info.pattern = loader.pattern
        if (typeof loader.base === 'string' && loader.base.length > 0) {
          const abs = resolve(ROOT_DIR, loader.base)
          const rel = relative(contentDirAbs, abs)
          if (!rel.startsWith('..')) info.base = rel
        }
      } else if (loader.__kind === 'file' && typeof loader.path === 'string') {
        const abs = resolve(ROOT_DIR, loader.path)
        const rel = relative(contentDirAbs, abs)
        if (!rel.startsWith('..')) info.filePath = rel
      }
    }

    // Schema: z.object, or ({ image }) => z.object(...)
    if (collection.schema) {
      let zodSchema: z.ZodObject<z.ZodRawShape> | null = null
      if (typeof collection.schema === 'function') {
        zodSchema = (collection.schema as any)({
          image: () => {
            const s = z.string()
            ;(s as any)[IMAGE_MARKER] = true
            return s
          },
        })
      } else if (collection.schema instanceof z.ZodObject) {
        zodSchema = collection.schema
      }
      if (zodSchema instanceof z.ZodObject) {
        info.schema = parseZodShape(zodSchema)
      }
    }

    result[name] = info
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
