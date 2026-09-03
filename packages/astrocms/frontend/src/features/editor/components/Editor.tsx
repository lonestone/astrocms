import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { ComponentMetaContext } from './CustomJsxEditor.js'
import { useComponents } from '../hooks/useComponents.js'
import { useFile, useSaveFile } from '../hooks/useFile.js'
import { MDXEditor, type MDXEditorMethods } from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { createPlugins } from './plugins.js'
import FrontmatterEditor, {
  extractEsmLines,
  combineEsmAndContent,
} from './FrontmatterEditor.js'
import {
  type FrontmatterData,
  extractBody,
  extractRawFrontmatter,
  parseFrontmatterYaml,
  combineFrontmatterAndBody,
} from '../../../../../shared/frontmatter.js'
import React from 'react'
import { TbAlertTriangle } from 'react-icons/tb'
import EditorHeader from './EditorHeader.js'
import { useFilePath } from '../contexts/FilePathContext.js'
import { useFiles } from '../../file/contexts/FilesContext.js'
import { getLocaleSiblings } from '../../common/utils/folderTarget.js'
import { getSchemaForFile } from '../../common/utils/collections.js'
import { useCollections } from '../../sidebar/hooks/useCollections.js'
import { usePublicConfig } from '../../common/hooks/usePublicConfig.js'
import { useSorts } from '../../sidebar/hooks/useFolderSort.js'
import { useNames } from '../../sidebar/hooks/useFolderName.js'
import {
  anyFieldChanged,
  getTreeRelevantFields,
} from '../utils/treeRelevantFields.js'
import {
  getDataFormat,
  isDataFormat,
  parseDataContent,
  serializeDataContent,
  inferSchemaFromData,
} from '../utils/dataFormats.js'

const AUTO_SAVE_DELAY_MS = 3000

interface Props {
  onSelectFile: (path: string) => void
}

export function Editor({ onSelectFile }: Props) {
  const filePath = useFilePath()!
  const { tree, invalidateTree } = useFiles()
  const format = useMemo(() => getDataFormat(filePath), [filePath])
  const dataOnly = isDataFormat(format)

  const localeSiblings = useMemo(
    () => getLocaleSiblings(tree, filePath),
    [tree, filePath]
  )

  const { data: fileData, isLoading, error } = useFile(filePath)
  const saveFile = useSaveFile()
  const { jsxDescriptors, componentMeta } = useComponents()
  const publicConfig = usePublicConfig()
  const mediaDirsRef = useRef(publicConfig)
  mediaDirsRef.current = publicConfig

  // Frontmatter/data and body are managed separately
  const [frontmatter, setFrontmatter] = useState<FrontmatterData>({})
  const [originalFrontmatter, setOriginalFrontmatter] =
    useState<FrontmatterData>({})
  const [body, setBody] = useState('')
  const [originalBody, setOriginalBody] = useState('')
  const [ready, setReady] = useState(false)
  const editorRef = useRef<MDXEditorMethods>(null)
  const bodyRef = useRef('')
  const frontmatterRef = useRef<FrontmatterData>({})
  // ESM (import/export) lines are stripped before passing to MDXEditor
  // and re-prepended on save, since MDXEditor does not preserve them
  const esmRef = useRef('')

  // Resolve schema from the collections index (no per-file round trip).
  const { data: collectionsData } = useCollections()
  const collections = collectionsData?.collections ?? {}
  const schemaError = collectionsData?.error
  const serverSchema = useMemo(
    () => getSchemaForFile(filePath, collections),
    [filePath, collections]
  )
  const savedSorts = useSorts()
  const savedNames = useNames()
  const treeRelevantFields = useMemo(
    () => getTreeRelevantFields(filePath, collections, savedSorts, savedNames),
    [filePath, collections, savedSorts, savedNames]
  )

  // For data files without an explicit schema, infer fields from data
  const schema = useMemo(() => {
    if (serverSchema && serverSchema.length > 0) return serverSchema
    if (dataOnly) return inferSchemaFromData(frontmatter)
    return serverSchema
  }, [serverSchema, dataOnly, frontmatter])

  // Sync loaded file content into local state
  useEffect(() => {
    if (fileData !== undefined) {
      if (dataOnly) {
        const data = parseDataContent(fileData.content, format)
        setFrontmatter(data)
        setOriginalFrontmatter(data)
        frontmatterRef.current = data
        esmRef.current = ''
        setBody('')
        setOriginalBody('')
        bodyRef.current = ''
      } else {
        const rawYaml = extractRawFrontmatter(fileData.content)
        const fm = rawYaml ? parseFrontmatterYaml(rawYaml) : {}
        const rawBody = extractBody(fileData.content)
        const { esm, content } = extractEsmLines(rawBody)

        setFrontmatter(fm)
        setOriginalFrontmatter(fm)
        frontmatterRef.current = fm
        esmRef.current = esm
        setBody(content)
        setOriginalBody(content)
        bodyRef.current = content
      }
      setReady(true)
    }
  }, [fileData, dataOnly, format])

  const isDirty =
    body !== originalBody ||
    JSON.stringify(frontmatter) !== JSON.stringify(originalFrontmatter)

  const lastSaveAt = useRef(0)

  const handleSave = useCallback(async () => {
    const frontmatterAtSave = frontmatterRef.current
    const bodyAtSave = bodyRef.current
    const priorFrontmatter = originalFrontmatter
    let content: string
    if (dataOnly) {
      content = serializeDataContent(frontmatterAtSave, format)
    } else {
      const fullBody = combineEsmAndContent(esmRef.current, bodyAtSave)
      content = combineFrontmatterAndBody(frontmatterAtSave, fullBody)
    }
    await saveFile.mutateAsync({ path: filePath, content })
    lastSaveAt.current = Date.now()
    setOriginalBody(bodyAtSave)
    setOriginalFrontmatter(frontmatterAtSave)
    if (
      treeRelevantFields.length > 0 &&
      anyFieldChanged(treeRelevantFields, priorFrontmatter, frontmatterAtSave)
    ) {
      invalidateTree()
    }
  }, [
    filePath,
    saveFile,
    dataOnly,
    format,
    originalFrontmatter,
    treeRelevantFields,
    invalidateTree,
  ])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        const fmDirty =
          JSON.stringify(frontmatterRef.current) !==
          JSON.stringify(originalFrontmatter)
        const bodyDirty = bodyRef.current !== originalBody
        if (fmDirty || bodyDirty) handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [originalFrontmatter, originalBody, handleSave])

  // Leading-edge auto-save: first edit saves immediately; subsequent edits
  // within AUTO_SAVE_DELAY_MS of the previous save are coalesced and flushed
  // once the window expires.
  useEffect(() => {
    if (!ready || !isDirty || saveFile.isPending) return
    const remaining = Math.max(
      0,
      AUTO_SAVE_DELAY_MS - (Date.now() - lastSaveAt.current)
    )
    const timer = setTimeout(() => {
      handleSave()
    }, remaining)
    return () => clearTimeout(timer)
  }, [ready, isDirty, saveFile.isPending, body, frontmatter, handleSave])

  const handleBodyChange = useCallback(
    (markdown: string, initialMarkdownNormalize: boolean) => {
      setBody(markdown)
      bodyRef.current = markdown
      // MDXEditor (Lexical) reformats the source when it first loads the
      // markdown (bullet symbols, whitespace, escaping...). That fires onChange
      // with initialMarkdownNormalize=true. Adopt the normalized form as the
      // baseline so this reformatting is not treated as a user edit and never
      // gets auto-saved.
      if (initialMarkdownNormalize) {
        setOriginalBody(markdown)
      }
    },
    []
  )

  const handleFrontmatterChange = useCallback((data: FrontmatterData) => {
    setFrontmatter(data)
    frontmatterRef.current = data
  }, [])

  // Memoize plugins to avoid MDXEditor reinitialization on re-renders
  const plugins = useMemo(
    () =>
      jsxDescriptors
        ? createPlugins({
            filePath,
            jsxDescriptors,
            originalContent: originalBody,
            getMediaDirs: () => mediaDirsRef.current,
          })
        : undefined,
    // Recreate plugins when ready flips to true (with correct originalBody).
    // MDXEditor isn't mounted until ready, so this doesn't cause reinitialization.
    [filePath, jsxDescriptors, ready]
  )

  const loading = dataOnly
    ? isLoading || !ready
    : isLoading || !ready || !plugins

  return (
    <div className="flex h-full flex-col">
      <EditorHeader
        isDirty={isDirty}
        isSaving={saveFile.isPending}
        localeSiblings={localeSiblings}
        onSelectFile={onSelectFile}
      />
      {schemaError && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning-text">
          <TbAlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">Schema parsing failed.</span>{' '}
            {schemaError}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col overflow-auto rounded-panel border border-border bg-surface-raised shadow-[0_1px_2px_rgb(var(--c-shadow)/0.04)]">
        {error ? (
          <div className="flex flex-col items-center gap-1 px-5 py-16 text-center">
            <p className="text-sm font-medium text-danger-text">
              File not found
            </p>
            <p className="font-mono text-xs text-text-muted">{filePath}</p>
          </div>
        ) : loading ? (
          <EditorSkeleton />
        ) : (
          <>
            {schema && schema.length > 0 && (
              <FrontmatterEditor
                schema={schema}
                frontmatter={frontmatter}
                onChange={handleFrontmatterChange}
              />
            )}
            {!dataOnly && (
              <ComponentMetaContext.Provider value={componentMeta}>
                <MDXEditor
                  ref={editorRef}
                  markdown={originalBody}
                  onChange={handleBodyChange}
                  contentEditableClassName="mdxeditor-rich-text"
                  plugins={plugins!}
                  className="flex-1"
                />
              </ComponentMetaContext.Provider>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading file">
      <div className="flex flex-col gap-2.5 border-b border-border bg-surface px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="skeleton h-3 w-20" />
          <span className="skeleton h-6 flex-1" />
        </div>
        <div className="flex items-center gap-3">
          <span className="skeleton h-3 w-20" />
          <span className="skeleton h-6 w-1/2" />
        </div>
      </div>
      <div className="flex h-10 items-center gap-2 border-b border-border bg-surface px-3">
        {[...Array(6)].map((_, i) => (
          <span key={i} className="skeleton h-5 w-7" />
        ))}
      </div>
      <div className="flex flex-col gap-3 px-8 py-6">
        <span className="skeleton h-6 w-2/3" />
        <span className="skeleton h-3.5 w-full" />
        <span className="skeleton h-3.5 w-11/12" />
        <span className="skeleton h-3.5 w-4/5" />
        <span className="mt-3 skeleton h-3.5 w-full" />
        <span className="skeleton h-3.5 w-3/4" />
      </div>
    </div>
  )
}
