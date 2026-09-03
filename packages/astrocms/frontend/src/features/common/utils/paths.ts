/** Parent directory of a slash-separated path ("" for top-level entries). */
export function parentOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
}

/** Join path segments, skipping empty ones. */
export function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/')
}

/**
 * Resolve "." and ".." segments and strip empty ones.
 * Returns null when the path climbs above its starting point.
 */
export function normalizePath(path: string): string | null {
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (out.length === 0) return null
      out.pop()
    } else {
      out.push(part)
    }
  }
  return out.join('/')
}

/** Relative path from a file to a target file, always prefixed with "./" or "../". */
export function relativePath(fromFile: string, toFile: string): string {
  const fromParts = parentOf(fromFile).split('/').filter(Boolean)
  const toParts = toFile.split('/').filter(Boolean)
  let common = 0
  while (
    common < fromParts.length &&
    common < toParts.length &&
    fromParts[common] === toParts[common]
  ) {
    common++
  }
  const ups = fromParts.length - common
  const rest = toParts.slice(common).join('/')
  return (ups > 0 ? '../'.repeat(ups) : './') + rest
}
