/**
 * Stub for 'astro/loaders' used when loading content.config.ts outside of Astro.
 * We don't actually load content here; we just preserve the arguments so the
 * schema parser can read them (pattern/base for `glob`, path for `file`).
 */
export function glob(opts: { pattern?: string | string[]; base?: string }) {
  return { __kind: 'glob', pattern: opts.pattern, base: opts.base }
}

// Real signature: file(path: string, opts?: { parser?: ... })
export function file(
  path: string | { base?: string; [k: string]: unknown },
  _opts?: unknown
) {
  if (typeof path === 'string') return { __kind: 'file', path }
  return { __kind: 'file', ...path }
}
