import React, { useState, useEffect, useCallback } from 'react'
import {
  imageDialogState$,
  closeImageDialog$,
  insertImage$,
  saveImage$,
} from '@mdxeditor/editor'
import { useCellValue, usePublisher } from '@mdxeditor/gurx'
import { useMediaModal } from '../../file/components/MediaModal.js'
import { useFilePath } from '../contexts/FilePathContext.js'
import { resolvePreviewSrc } from '../utils/resolvePreviewSrc.js'
import { usePublicConfig } from '../../common/hooks/usePublicConfig.js'
import Button from '../../common/components/Button.js'
import { Dialog } from '../../common/components/Dialog.js'
import { Field, Input } from '../../common/components/Input.js'

export function CustomImageDialog() {
  const state = useCellValue(imageDialogState$)
  const closeDialog = usePublisher(closeImageDialog$)
  const insertImage = usePublisher(insertImage$)
  const saveImage = usePublisher(saveImage$)
  const { openMediaModal } = useMediaModal()
  const filePath = useFilePath()!
  const config = usePublicConfig()

  const [src, setSrc] = useState('')
  const [alt, setAlt] = useState('')

  const isEditing = state.type === 'editing'
  const isActive = state.type !== 'inactive'

  // Sync form state when dialog opens
  useEffect(() => {
    if (state.type === 'editing') {
      setSrc(state.initialValues.src ?? '')
      setAlt(state.initialValues.altText ?? '')
    } else if (state.type === 'new') {
      setSrc('')
      setAlt('')
    }
  }, [state])

  const handleSelectMedia = useCallback(() => {
    openMediaModal({
      filePath,
      onSelect: (relativePath) => {
        setSrc(relativePath)
      },
    })
  }, [filePath, openMediaModal])

  const handleSave = useCallback(() => {
    if (!src) return
    if (isEditing) {
      saveImage({ src, altText: alt })
    } else {
      insertImage({ src, altText: alt })
    }
    closeDialog()
  }, [src, alt, isEditing, insertImage, saveImage, closeDialog])

  const handleCancel = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  if (!isActive) return null

  const previewSrc = resolvePreviewSrc(src, filePath, config)

  return (
    <Dialog
      title={isEditing ? 'Edit image' : 'Insert image'}
      onClose={handleCancel}
      width="md"
      footer={
        <>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!src}>
            {isEditing ? 'Save' : 'Insert'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex h-36 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-inset">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-text-faint">
              Pick a file to preview it here
            </span>
          )}
        </div>

        <Field label="Source" htmlFor="image-src">
          <div className="flex gap-1.5">
            <Input
              id="image-src"
              type="text"
              value={src}
              onChange={(e) => setSrc(e.target.value)}
              placeholder="./image.png"
              className="font-mono text-xs"
              autoFocus
            />
            <Button onClick={handleSelectMedia} className="h-auto shrink-0">
              Browse
            </Button>
          </div>
        </Field>

        <Field
          label="Alt text"
          htmlFor="image-alt"
          hint="Describes the image for screen readers and search engines."
        >
          <Input
            id="image-alt"
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="A short description"
          />
        </Field>
      </div>
    </Dialog>
  )
}
