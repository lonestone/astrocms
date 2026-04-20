function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/**
 * Case- and accent-insensitive subsequence match: returns true when every
 * character of `query` appears in `text` in order.
 */
export function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return false
  const t = normalize(text)
  const q = normalize(query)
  let qi = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++
  }
  return qi === q.length
}
