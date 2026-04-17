import { readFile } from 'fs/promises'
import { join } from 'path'
import { ROOT_DIR } from './root.js'

export interface AstroCmsConfig {
  contentDir: string
  contentConfig: string
  assetsDir?: string
  componentsDir?: string
  websiteUrl?: string
}

const envOverrides = {
  contentDir: 'ASTROCMS_CONTENT_DIR',
  contentConfig: 'ASTROCMS_CONTENT_CONFIG',
  assetsDir: 'ASTROCMS_ASSETS_DIR',
  componentsDir: 'ASTROCMS_COMPONENTS_DIR',
  websiteUrl: 'ASTROCMS_WEBSITE_URL',
} as const

let cached: AstroCmsConfig | null = null

function pick(
  key: keyof typeof envOverrides,
  fileValue: string | undefined,
  defaultValue?: string,
): string | undefined {
  const fromEnv = process.env[envOverrides[key]]
  if (fromEnv && fromEnv.length > 0) return fromEnv
  return fileValue ?? defaultValue
}

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
    contentDir: pick('contentDir', fileConfig.contentDir, 'src/content')!,
    contentConfig: pick('contentConfig', fileConfig.contentConfig, 'src/content.config.ts')!,
    assetsDir: pick('assetsDir', fileConfig.assetsDir),
    componentsDir: pick('componentsDir', fileConfig.componentsDir),
    websiteUrl: pick('websiteUrl', fileConfig.websiteUrl),
  }

  return cached
}
