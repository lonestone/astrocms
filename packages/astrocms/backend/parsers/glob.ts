import picomatch from 'picomatch'

/**
 * Match a file path (forward-slash separated, relative to the base) against
 * one or more glob patterns.
 *
 * Delegates to `picomatch`, the exact engine Astro's `glob()` loader uses to
 * decide collection membership (`picomatch.isMatch(entry, pattern)`), so the
 * behavior here stays identical to Astro for `**`, `*`, `?`, `{a,b}` brace
 * groups, and `[...]` / `[^...]` / `[!...]` character classes.
 */
export function matchGlob(
  filePath: string,
  patterns: string | string[]
): boolean {
  return picomatch.isMatch(filePath, patterns)
}
