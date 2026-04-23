import YAML from 'yaml'

export type FrontmatterData = Record<string, unknown>

/**
 * Matches an opening `---` fence, the YAML block, and the closing `---`.
 * Leading whitespace and newlines before the fence are tolerated so that
 * files authored with a blank line on top still parse correctly.
 */
export const FRONTMATTER_RE = /^\s*---\r?\n([\s\S]*?)\r?\n---/

/** Extract the raw YAML block from a markdown/MDX document, if any. */
export function extractRawFrontmatter(content: string): string | undefined {
  const match = content.match(FRONTMATTER_RE)
  return match ? match[1] : undefined
}

/** Return the document body with the frontmatter block (and its trailing newline) stripped. */
export function extractBody(content: string): string {
  return content.replace(FRONTMATTER_RE, '').replace(/^\r?\n/, '')
}

/** Parse a YAML frontmatter string into a plain object. Invalid / non-object → empty. */
export function parseFrontmatterYaml(yaml: string): FrontmatterData {
  const result = YAML.parse(yaml)
  return result && typeof result === 'object' ? result : {}
}

/** Serialize frontmatter data to YAML. Empty scalars and empty arrays are dropped. */
export function serializeFrontmatterYaml(data: FrontmatterData): string {
  const filtered: FrontmatterData = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === '' || value === undefined || value === null) continue
    if (Array.isArray(value) && value.length === 0) continue
    filtered[key] = value
  }
  if (Object.keys(filtered).length === 0) return ''
  return YAML.stringify(filtered, { lineWidth: 0 }).trimEnd()
}

/** Combine frontmatter data and body into a full markdown document. */
export function combineFrontmatterAndBody(
  data: FrontmatterData,
  body: string
): string {
  const yaml = serializeFrontmatterYaml(data)
  if (!yaml) return body
  return `---\n${yaml}\n---\n\n${body}`
}

/**
 * Parse frontmatter from a supported content file's raw contents.
 * - `.md` / `.mdx`: extract the YAML block and parse it.
 * - `.yaml` / `.yml`: parse the whole document as YAML.
 * - `.json`: parse the whole document as JSON.
 * Any parse failure returns an empty object.
 */
export function parseFileFrontmatter(
  content: string,
  ext: string
): FrontmatterData {
  try {
    if (ext === '.md' || ext === '.mdx') {
      const yaml = extractRawFrontmatter(content)
      return yaml ? parseFrontmatterYaml(yaml) : {}
    }
    if (ext === '.yaml' || ext === '.yml') {
      return parseFrontmatterYaml(content)
    }
    if (ext === '.json') {
      const parsed = JSON.parse(content)
      return parsed && typeof parsed === 'object' ? parsed : {}
    }
  } catch {
    return {}
  }
  return {}
}
