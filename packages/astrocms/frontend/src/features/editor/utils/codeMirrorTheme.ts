import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

/**
 * CodeMirror theme for code blocks inside the MDX editor. Every color is a
 * CSS variable defined in styles.css, so the same extension serves both the
 * light and the dark theme and switches live with the app.
 *
 * MDXEditor also installs its own `basicLight` theme, whose rules end up
 * later in the document and would win on equal specificity. Every selector
 * below is therefore anchored on `.cm-editor` to score higher, and the
 * highlight rules are nested under it for the same reason.
 */
const chrome = EditorView.theme({
  '&.cm-editor': {
    color: 'var(--cm-text)',
    backgroundColor: 'var(--cm-bg)',
  },
  '&.cm-editor .cm-content': {
    caretColor: 'var(--cm-cursor)',
  },
  '&.cm-editor .cm-cursor, &.cm-editor .cm-dropCursor': { borderLeftColor: 'var(--cm-cursor)' },
  '&.cm-editor.cm-focused .cm-selectionBackground, &.cm-editor .cm-selectionBackground, &.cm-editor .cm-content ::selection':
    { backgroundColor: 'var(--cm-selection)' },
  '&.cm-editor .cm-activeLine': { backgroundColor: 'var(--cm-active-line)' },
  '&.cm-editor .cm-selectionMatch': { backgroundColor: 'var(--cm-selection)' },
  '&.cm-editor .cm-searchMatch': {
    backgroundColor: 'var(--cm-selection)',
    outline: '1px solid var(--cm-border)',
  },
  '&.cm-editor.cm-focused .cm-matchingBracket, &.cm-editor.cm-focused .cm-nonmatchingBracket': {
    outline: '1px solid var(--cm-border)',
    backgroundColor: 'var(--cm-active-line)',
  },
  '&.cm-editor .cm-gutters': {
    backgroundColor: 'var(--cm-bg)',
    color: 'var(--cm-gutter)',
    border: 'none',
  },
  '&.cm-editor .cm-activeLineGutter': { backgroundColor: 'var(--cm-active-line)' },
  '&.cm-editor .cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--cm-gutter)',
  },
  '&.cm-editor .cm-tooltip': {
    border: '1px solid var(--cm-border)',
    backgroundColor: 'var(--cm-tooltip-bg)',
    color: 'var(--cm-text)',
  },
  '&.cm-editor .cm-tooltip-autocomplete': {
    '& > ul > li[aria-selected]': {
      backgroundColor: 'var(--cm-active-line)',
      color: 'var(--cm-text)',
    },
  },
})

const highlight = HighlightStyle.define([
  { tag: t.keyword, '.cm-editor &': { color: 'var(--cm-keyword)' } },
  { tag: [t.controlKeyword, t.moduleKeyword], '.cm-editor &': { color: 'var(--cm-keyword)' } },
  { tag: [t.operator, t.operatorKeyword], '.cm-editor &': { color: 'var(--cm-operator)' } },
  { tag: [t.string, t.special(t.string), t.character], '.cm-editor &': { color: 'var(--cm-string)' } },
  { tag: [t.regexp, t.escape], '.cm-editor &': { color: 'var(--cm-regexp)' } },
  { tag: [t.number, t.integer, t.float, t.bool, t.null, t.atom], '.cm-editor &': { color: 'var(--cm-number)' } },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], '.cm-editor &': { color: 'var(--cm-comment)', fontStyle: 'italic' } },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], '.cm-editor &': { color: 'var(--cm-function)' } },
  { tag: [t.variableName, t.definition(t.variableName)], '.cm-editor &': { color: 'var(--cm-variable)' } },
  { tag: [t.propertyName, t.definition(t.propertyName), t.labelName], '.cm-editor &': { color: 'var(--cm-property)' } },
  { tag: [t.typeName, t.className, t.namespace, t.constant(t.name), t.standard(t.name)], '.cm-editor &': { color: 'var(--cm-type)' } },
  { tag: [t.tagName, t.angleBracket], '.cm-editor &': { color: 'var(--cm-tag)' } },
  { tag: [t.attributeName, t.attributeValue], '.cm-editor &': { color: 'var(--cm-attribute)' } },
  { tag: [t.punctuation, t.separator, t.bracket, t.brace, t.paren, t.squareBracket], '.cm-editor &': { color: 'var(--cm-punctuation)' } },
  { tag: [t.meta, t.processingInstruction, t.annotation, t.modifier, t.self], '.cm-editor &': { color: 'var(--cm-meta)' } },
  { tag: t.heading, '.cm-editor &': { color: 'var(--cm-heading)', fontWeight: 'bold' } },
  { tag: t.strong, '.cm-editor &': { fontWeight: 'bold' } },
  { tag: t.emphasis, '.cm-editor &': { fontStyle: 'italic' } },
  { tag: t.strikethrough, '.cm-editor &': { textDecoration: 'line-through' } },
  { tag: [t.link, t.url], '.cm-editor &': { color: 'var(--cm-link)', textDecoration: 'underline' } },
  { tag: [t.inserted], '.cm-editor &': { color: 'var(--cm-string)' } },
  { tag: [t.deleted, t.invalid], '.cm-editor &': { color: 'var(--cm-invalid)' } },
])

export const codeMirrorTheme = [chrome, syntaxHighlighting(highlight)]
