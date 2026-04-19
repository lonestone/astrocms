import type { TreeNode } from '../../../api.js'
import { isSupportedFile } from '../../common/utils/supportedFiles.js'

export function hasSupportedFiles(node: TreeNode): boolean {
  if (node.type === 'file') return isSupportedFile(node.name)
  return node.children?.some(hasSupportedFiles) === true
}
