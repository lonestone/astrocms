/**
 * Minimal glob-to-regex for Astro content patterns like:
 *   - `**\/*.mdx`
 *   - `**\/*.{md,mdx}`
 *   - `*.yaml`
 *   - `data/**\/*.json`
 *
 * Supports `**`, `*`, `?`, and `{a,b,...}` brace groups. No negation, no
 * character classes — these aren't used in Astro `glob()` calls.
 */
function globToRegex(pattern: string): RegExp {
  // Extract brace groups first so their commas don't get escaped.
  const groups: string[] = []
  let idx = 0
  let p = pattern.replace(/\{([^{}]+)\}/g, (_, g) => {
    groups.push(g)
    return `\x00${idx++}\x00`
  })

  // Escape regex-special chars (brace placeholders and wildcards survive).
  p = p.replace(/[.+^$|()\\[\]]/g, '\\$&')

  // Translate wildcards, using distinctive placeholders for `**` first so
  // `*` replacement doesn't eat them.
  p = p
    .replace(/\*\*\//g, '\x01')
    .replace(/\*\*/g, '\x02')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\x01/g, '(?:.*/)?')
    .replace(/\x02/g, '.*')

  // Restore brace groups as alternations.
  p = p.replace(/\x00(\d+)\x00/g, (_, i) => {
    const alts = groups[Number(i)]
      .split(',')
      .map((s) => s.replace(/[.+^$|()\\[\]*?]/g, '\\$&'))
    return `(?:${alts.join('|')})`
  })

  return new RegExp(`^${p}$`)
}

/**
 * Match a file path (forward-slash separated, relative to the base) against
 * one or more glob patterns.
 */
export function matchGlob(
  filePath: string,
  patterns: string | string[]
): boolean {
  const list = Array.isArray(patterns) ? patterns : [patterns]
  for (const pattern of list) {
    if (globToRegex(pattern).test(filePath)) return true
  }
  return false
}
