import React, { useMemo } from 'react'
import { marked } from 'marked'

marked.setOptions({ breaks: true })

interface Props {
  text: string
  variant: 'user' | 'assistant'
}

export function TextBlock({ text, variant }: Props) {
  if (variant === 'assistant') {
    return <MarkdownBlock text={text} />
  }

  return (
    <div className="mb-3 ml-8 whitespace-pre-wrap break-words rounded-panel rounded-tr-md bg-accent px-3.5 py-2.5 text-base leading-relaxed text-accent-fg">
      {text}
    </div>
  )
}

function MarkdownBlock({ text }: { text: string }) {
  const html = useMemo(() => marked.parse(text) as string, [text])

  return (
    <div
      className="prose-agent mb-3 break-words px-1 text-base leading-relaxed text-text"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
