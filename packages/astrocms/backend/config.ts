import { readFile } from 'fs/promises'
import { join } from 'path'
import { ROOT_DIR } from './root.js'

export interface AstroCmsConfig {
  contentDir: string
  contentConfig: string
  assetsDir?: string
  componentsDir?: string
}

const defaults: AstroCmsConfig = {
  contentDir: 'src/content',
  contentConfig: 'src/content.config.ts',
  assetsDir: undefined,
  componentsDir: undefined,
}

let cached: AstroCmsConfig | null = null

export async function loadConfig(): Promise<AstroCmsConfig> {
  if (cached) return cached

  let fileConfig: Partial<AstroCmsConfig> = {}
  try {
    const raw = await readFile(join(ROOT_DIR, 'astrocms.json'), 'utf-8')
    fileConfig = JSON.parse(raw)
  } catch {
    // No config file, use defaults
  }

  cached = {
    contentDir: fileConfig.contentDir || defaults.contentDir,
    contentConfig: fileConfig.contentConfig || defaults.contentConfig,
    assetsDir: fileConfig.assetsDir || defaults.assetsDir,
    componentsDir: fileConfig.componentsDir || defaults.componentsDir,
  }

  return cached
}
