/**
 * Stub for 'astro:content' used when loading content.config.ts outside of Astro.
 * Provides minimal implementations of defineCollection, glob, and re-exports z.
 */
export { z } from 'zod'

export function defineCollection(config: any) {
  return config
}

export function glob(_opts: any) {
  return {}
}

export function file(_opts: any) {
  return {}
}

export function reference(_collection: string) {
  return {}
}
