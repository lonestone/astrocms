/**
 * Stub for 'astro:content' used when loading content.config.ts outside of Astro.
 * Only exports the APIs the user's config is expected to import from this module.
 * Loader factories (glob, file) live in 'astro/loaders' and are stubbed there.
 */
export { z } from 'zod'

export function defineCollection(config: any) {
  return config
}

export function reference(_collection: string) {
  return {}
}
