/**
 * Subsequence fuzzy match (case-insensitive).
 * Returns the indices in `text` where `query` characters matched, in order.
 * Returns `null` if the query isn't a subsequence of the text.
 */
export function fuzzyMatch(text: string, query: string): number[] | null {
  if (!query) return null
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  const indices: number[] = []
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti)
      qi++
    }
  }
  return qi === q.length ? indices : null
}
