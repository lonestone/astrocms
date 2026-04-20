import type { TreeNode } from '../../../api.js'
import { isSupportedFile, stripExtension } from './supportedFiles.js'

/** All locales found in any "locale folder" (files with 2-letter basenames). */
export function collectLocalesInTree(tree: TreeNode[]): Set<string> {
  const out = new Set<string>()
  function walk(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (node.type !== 'directory' || !node.children) continue
      const files = node.children.filter(
        (c) => c.type === 'file' && isSupportedFile(c.name)
      )
      const allLocale =
        files.length > 0 &&
        files.every((f) => stripExtension(f.name).length === 2)
      if (allLocale) {
        for (const f of files) out.add(stripExtension(f.name))
      }
      walk(node.children)
    }
  }
  walk(tree)
  return out
}

/**
 * Resolve the language to prefer when a folder collapses to one of several
 * locale files. Priority: the user's explicit pick, then the browser's
 * language, then "en", then the first locale alphabetically.
 */
export function resolveEffectiveLang(
  available: Set<string>,
  currentLang: string | null,
  browserLang: string | null = null
): string | null {
  if (currentLang && available.has(currentLang)) return currentLang
  if (browserLang && available.has(browserLang)) return browserLang
  if (available.has('en')) return 'en'
  const sorted = [...available].sort()
  return sorted[0] ?? null
}
