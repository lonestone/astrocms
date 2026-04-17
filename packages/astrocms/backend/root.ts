import { resolve } from 'path'

/**
 * Root directory of the target Astro project.
 * Set via ASTROCMS_ROOT env var, or defaults to the current working directory.
 */
export const ROOT_DIR = resolve(process.env.ASTROCMS_ROOT || process.cwd())
