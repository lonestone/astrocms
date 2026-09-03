import React, {
  createContext,
  useContext,
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from 'react'
import {
  type JsxEditorProps,
  useMdastNodeUpdater,
  useLexicalNodeRemove,
  useNestedEditorContext,
} from '@mdxeditor/editor'
import {
  $createNodeSelection,
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isNodeSelection,
  $setSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
} from 'lexical'
import type { ComponentDescriptor, PropSchema } from '../../../api.js'
import {
  TbComponents,
  TbCopy,
  TbGripVertical,
  TbTrash,
} from 'react-icons/tb'
import { IconButton } from '../../common/components/IconButton.js'
import { PropInput } from './PropInput.js'
import JsonTableEditor from './JsonTableEditor.js'
import SlotEditor from './SlotEditor.js'
import {
  DRAG_DATA_FORMAT,
  startBlockDrag,
  endBlockDrag,
} from './BlockDragDropPlugin.js'

// Context to pass rich prop metadata from Editor to CustomJsxEditor
export const ComponentMetaContext = createContext<
  Record<string, ComponentDescriptor>
>({})

const isExpressionValue = (
  value: unknown
): value is { type: string; value: string } =>
  value !== null &&
  typeof value === 'object' &&
  'type' in (value as Record<string, unknown>) &&
  'value' in (value as Record<string, unknown>) &&
  typeof (value as Record<string, string>).value === 'string'

const isMdxJsxAttribute = (
  attr: unknown
): attr is { type: 'mdxJsxAttribute'; name: string; value: unknown } =>
  typeof attr === 'object' &&
  attr !== null &&
  (attr as Record<string, unknown>).type === 'mdxJsxAttribute' &&
  typeof (attr as Record<string, unknown>).name === 'string'

export function CustomJsxEditor({ mdastNode, descriptor }: JsxEditorProps) {
  const updateMdastNode = useMdastNodeUpdater()
  const removeNode = useLexicalNodeRemove()
  const { parentEditor, lexicalNode } = useNestedEditorContext()
  const meta = useContext(ComponentMetaContext)
  const componentMeta = mdastNode.name ? meta[mdastNode.name] : undefined

  const [selected, setSelected] = useState(false)
  const blockRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unregisterUpdate = parentEditor.registerUpdateListener(
      ({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection()
          if ($isNodeSelection(selection)) {
            setSelected(selection.has(lexicalNode.getKey()))
          } else {
            setSelected(false)
          }
        })
      }
    )

    const unregisterEnter = parentEditor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        const selection = $getSelection()
        if (
          $isNodeSelection(selection) &&
          selection.has(lexicalNode.getKey())
        ) {
          event?.preventDefault()
          const node = $getNodeByKey(lexicalNode.getKey())
          if (node) {
            const paragraph = $createParagraphNode()
            node.insertAfter(paragraph)
            paragraph.selectStart()
          }
          return true
        }
        return false
      },
      COMMAND_PRIORITY_LOW
    )

    const unregisterBlur = parentEditor.registerCommand(
      BLUR_COMMAND,
      () => {
        setSelected(false)
        return false
      },
      COMMAND_PRIORITY_LOW
    )

    return () => {
      unregisterUpdate()
      unregisterEnter()
      unregisterBlur()
    }
  }, [parentEditor, lexicalNode])

  const handleDuplicate = useCallback(() => {
    parentEditor.update(() => {
      const node = $getNodeByKey(lexicalNode.getKey())
      if (!node) return
      const serialized = node.exportJSON()
      const clone = (node.constructor as any).importJSON(serialized)
      node.insertAfter(clone)
    })
  }, [parentEditor, lexicalNode])

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_DATA_FORMAT, lexicalNode.getKey())
      e.dataTransfer.effectAllowed = 'move'
      startBlockDrag(parentEditor, lexicalNode.getKey())
      if (blockRef.current) {
        const rect = blockRef.current.getBoundingClientRect()
        e.dataTransfer.setDragImage(
          blockRef.current,
          e.clientX - rect.left,
          e.clientY - rect.top
        )
      }
    },
    [parentEditor, lexicalNode]
  )

  const handleDragEnd = useCallback(() => {
    endBlockDrag()
  }, [])

  const handleDelete = useCallback(() => {
    removeNode()
  }, [removeNode])

  const properties = useMemo(
    () =>
      descriptor.props.reduce<Record<string, string>>((acc, { name }) => {
        const attribute = mdastNode.attributes.find(
          (attr) => isMdxJsxAttribute(attr) && attr.name === name
        )
        if (attribute && isMdxJsxAttribute(attribute)) {
          if (isExpressionValue(attribute.value)) {
            acc[name] = attribute.value.value
            return acc
          }
          if (typeof attribute.value === 'string') {
            acc[name] = attribute.value
            return acc
          }
          if (attribute.value === null) {
            acc[name] = 'true'
            return acc
          }
        }
        acc[name] = ''
        return acc
      }, {}),
    [mdastNode, descriptor]
  )

  const handlePropChange = useCallback(
    (propName: string, value: string) => {
      const newValues = { ...properties, [propName]: value }
      const updatedAttributes = Object.entries(newValues)
        .filter(([, v]) => v !== '')
        .map(([name, value]) => {
          const richProp = componentMeta?.props.find((p) => p.name === name)
          if (richProp?.type === 'json') {
            return {
              type: 'mdxJsxAttribute' as const,
              name,
              value: {
                type: 'mdxJsxAttributeValueExpression' as const,
                value,
              },
            }
          }
          if (richProp?.type === 'boolean' && value === 'true') {
            return { type: 'mdxJsxAttribute' as const, name, value: null }
          }
          return { type: 'mdxJsxAttribute' as const, name, value }
        })
      updateMdastNode({ attributes: updatedAttributes })
    },
    [properties, componentMeta, updateMdastNode]
  )

  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      parentEditor.update(() => {
        const selection = $createNodeSelection()
        selection.add(lexicalNode.getKey())
        $setSelection(selection)
      })
    },
    [parentEditor, lexicalNode]
  )

  const componentName = mdastNode.name ?? 'Fragment'
  const slots = componentMeta?.slots ?? (descriptor.hasChildren ? [''] : [])
  const hasNamedSlots = slots.some((s) => s !== '')
  const hasBody = descriptor.props.length > 0 || slots.length > 0

  return (
    <div ref={blockRef} className="relative my-2">
      <div
        className={`overflow-hidden rounded-panel border transition-colors duration-150 ${
          selected
            ? 'border-accent ring-2 ring-ring'
            : 'border-border hover:border-border-strong'
        }`}
      >
        {/* Header */}
        <div
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onClick={handleSelect}
          className={`flex cursor-grab items-center gap-2 bg-surface px-2.5 py-1.5 text-ui active:cursor-grabbing ${
            hasBody ? 'border-b border-border' : ''
          }`}
        >
          <TbGripVertical size={16} className="shrink-0 text-text-faint" />
          <TbComponents size={16} className="shrink-0 text-accent-text" />
          <span className="flex-1 select-none truncate font-mono font-medium text-text-secondary">
            {componentName}
          </span>
          <span className="flex gap-0.5">
            <IconButton
              label="Duplicate component"
              size="sm"
              onClick={handleDuplicate}
            >
              <TbCopy size={15} />
            </IconButton>
            <IconButton
              label="Delete component"
              size="sm"
              tone="danger"
              onClick={handleDelete}
            >
              <TbTrash size={15} />
            </IconButton>
          </span>
        </div>

        {/* Props */}
        {descriptor.props.length > 0 && (
          <div
            className={`flex flex-col gap-2 bg-surface-raised px-3 py-2.5 text-ui ${
              slots.length > 0 ? 'border-b border-border' : ''
            }`}
          >
            {descriptor.props.map(({ name }) => {
              const rich = componentMeta?.props.find((p) => p.name === name)
              const value = properties[name] ?? ''

              if (rich?.type === 'json' && rich.itemSchema) {
                return (
                  <JsonTableEditor
                    key={name}
                    value={value || '[]'}
                    schema={rich.itemSchema}
                    onChange={(v) => handlePropChange(name, v)}
                  />
                )
              }

              return (
                <PropInput
                  key={name}
                  schema={rich ?? { name, type: 'string' }}
                  value={value}
                  onChange={(v) => handlePropChange(name, v)}
                />
              )
            })}
          </div>
        )}

        {/* Slots */}
        {slots.map((slotName, i) => (
          <div
            key={slotName}
            className={`relative bg-surface-raised px-3 py-2 ${
              i < slots.length - 1 ? 'border-b border-border' : ''
            } ${slotName ? '[&>div:last-child]:pt-6!' : ''}`}
          >
            {slots.length > 1 && (
              <div className="pointer-events-none absolute top-1.5 left-3 font-mono text-xs text-text-faint">
                {slotName || 'children'}
              </div>
            )}
            <SlotEditor slotName={slotName} hasNamedSlots={hasNamedSlots} />
          </div>
        ))}
      </div>
    </div>
  )
}
