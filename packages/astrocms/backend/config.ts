import { readFile } from 'fs/promises'
import { join } from 'path'
import { ROOT_DIR } from './root.js'

export interface GitFlowConfig {
  /** PR-based edits: the CMS works on a branch and opens pull requests. */
  prBasedEdits: boolean
  /** The protected base branch (main/master) that PRs target. */
  baseBranch: string
}

export interface AstroCmsConfig {
  contentDir: string
  contentConfig: string
  assetsDir?: string
  componentsDir?: string
  /** Optional in astrocms.json; loadConfig fills it with defaults. */
  git?: GitFlowConfig
}

/** Shape of the astrocms.json file; every key is optional. */
interface FileConfig {
  contentDir?: string
  contentConfig?: string
  assetsDir?: string
  componentsDir?: string
  git?: {
    prBasedEdits?: boolean
    baseBranch?: string
  }
}

const envOverrides = {
  contentDir: 'ASTROCMS_CONTENT_DIR',
  contentConfig: 'ASTROCMS_CONTENT_CONFIG',
  assetsDir: 'ASTROCMS_ASSETS_DIR',
  componentsDir: 'ASTROCMS_COMPONENTS_DIR',
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

/** '1'/'true' (any case) is true, any other non-empty value is false. */
function parseBoolEnv(value: string | undefined): boolean | undefined {
  if (!value || value.length === 0) return undefined
  return ['1', 'true'].includes(value.toLowerCase())
}

export async function loadConfig(): Promise<AstroCmsConfig> {
  if (cached) return cached

  let fileConfig: FileConfig = {}
  try {
    const raw = await readFile(join(ROOT_DIR, 'astrocms.json'), 'utf-8')
    fileConfig = JSON.parse(raw)
  } catch {
    // No config file, use defaults
  }

  const gitFile = fileConfig.git ?? {}
  // ASTROCMS_PR_BASED_EDITS flips the feature without touching the repo,
  // e.g. in Docker deployments where astrocms.json lives in the clone.
  const prEnv = parseBoolEnv(process.env.ASTROCMS_PR_BASED_EDITS)

  cached = {
    contentDir: pick('contentDir', fileConfig.contentDir, 'src/content')!,
    contentConfig: pick('contentConfig', fileConfig.contentConfig, 'src/content.config.ts')!,
    assetsDir: pick('assetsDir', fileConfig.assetsDir),
    componentsDir: pick('componentsDir', fileConfig.componentsDir),
    git: {
      prBasedEdits: prEnv ?? gitFile.prBasedEdits ?? false,
      // An explicit baseBranch in the file wins over GIT_BRANCH. In PR mode
      // GIT_BRANCH is a legacy fallback that names the base branch, not a
      // working branch.
      baseBranch: gitFile.baseBranch || process.env.GIT_BRANCH || 'main',
    },
  }

  return cached
}
