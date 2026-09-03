import {
  headingsPlugin,
  listsPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  thematicBreakPlugin,
  quotePlugin,
  markdownShortcutPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  jsxPlugin,
  toolbarPlugin,
  DiffSourceToggleWrapper,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CodeToggle,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  InsertCodeBlock,
  ListsToggle,
  Separator,
  type JsxComponentDescriptor,
} from '@mdxeditor/editor'
import { CustomImageDialog } from './ImageDialog.js'
import { InsertComponent } from './InsertComponent.js'
import { blockDragDropPlugin } from './BlockDragDropPlugin.js'
import { slashCommandPlugin } from './SlashCommandPlugin.js'
import { resolvePreviewSrc } from '../utils/resolvePreviewSrc.js'
import { codeMirrorTheme } from '../utils/codeMirrorTheme.js'
import type { MediaRootDirs } from '../../common/utils/mediaRoots.js'
import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { graphqlLanguageSupport } from 'cm6-graphql'
import React from 'react'

const graphqlLanguage = LanguageDescription.of({
  name: 'GraphQL',
  extensions: ['graphql', 'gql'],
  support: graphqlLanguageSupport(),
})

const codeBlockLanguages = [
  { name: 'Plain text', extensions: [''] },
  ...[...languages, graphqlLanguage].sort((a, b) =>
    a.name.localeCompare(b.name)
  ),
]

interface CreatePluginsParams {
  filePath: string
  jsxDescriptors: JsxComponentDescriptor[]
  originalContent: string
  /** Read at preview time so a late config load never reinitializes the editor. */
  getMediaDirs: () => MediaRootDirs | undefined
}

export function createPlugins({
  filePath,
  jsxDescriptors,
  originalContent,
  getMediaDirs,
}: CreatePluginsParams) {
  return [
    headingsPlugin(),
    listsPlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    imagePlugin({
      ImageDialog: CustomImageDialog,
      imagePreviewHandler: async (src) => {
        return resolvePreviewSrc(src, filePath, getMediaDirs()) ?? src
      },
    }),
    tablePlugin(),
    thematicBreakPlugin(),
    quotePlugin(),

    markdownShortcutPlugin(),
    codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
    codeMirrorPlugin({
      codeBlockLanguages,
      codeMirrorExtensions: [codeMirrorTheme],
    }),
    jsxPlugin({ jsxComponentDescriptors: jsxDescriptors }),
    blockDragDropPlugin(),
    slashCommandPlugin(),
    diffSourcePlugin({
      diffMarkdown: originalContent,
      viewMode: 'rich-text',
    }),
    toolbarPlugin({
      toolbarContents: () => (
        <DiffSourceToggleWrapper>
          <UndoRedo />
          <Separator />
          <BoldItalicUnderlineToggles />
          <CodeToggle />
          <Separator />
          <BlockTypeSelect />
          <Separator />
          <ListsToggle />
          <Separator />
          <CreateLink />
          <InsertImage />
          <InsertTable />
          <InsertCodeBlock />
          <InsertThematicBreak />
          <Separator />
          <InsertComponent />
        </DiffSourceToggleWrapper>
      ),
    }),
  ]
}
