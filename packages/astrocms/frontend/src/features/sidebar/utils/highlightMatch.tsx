import React from 'react'

/**
 * Render `text` with the characters at `indices` wrapped in a highlight span.
 * Consecutive matched characters are grouped into one span.
 */
export function highlightMatch(
  text: string,
  indices: number[] | undefined
): React.ReactNode {
  if (!indices || indices.length === 0) return text
  const set = new Set(indices)
  const out: React.ReactNode[] = []
  let i = 0
  while (i < text.length) {
    const isMatch = set.has(i)
    let j = i
    while (j < text.length && set.has(j) === isMatch) j++
    const piece = text.slice(i, j)
    out.push(
      isMatch ? (
        <mark
          key={i}
          className="bg-yellow-200/70 text-inherit rounded-sm px-px"
        >
          {piece}
        </mark>
      ) : (
        <React.Fragment key={i}>{piece}</React.Fragment>
      )
    )
    i = j
  }
  return <>{out}</>
}
