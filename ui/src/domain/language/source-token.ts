/** Source text owns punctuation and spacing; annotations never add characters. */
export function sourceToken(source: string, token: string, cursor: number): { start: number; end: number; text: string } | null {
  if (!token) throw new Error('An annotation token must not be empty')
  const candidates = [...new Set([token, token.replace(/^[\p{P}\s]+/u, ''), token.replace(/[\p{P}\s]+$/u, ''), token.replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '')])].filter(Boolean)
  if (!/[\p{L}\p{N}]/u.test(token)) {
    const start = cursor + source.slice(cursor).length - source.slice(cursor).trimStart().length
    return source.startsWith(token, start) ? { start, end: start + token.length, text: token } : null
  }
  const matches = candidates.map(text => ({ start: source.indexOf(text, cursor), text }))
    .filter(match => match.start >= 0).sort((a, b) => a.start - b.start || b.text.length - a.text.length)
  const match = matches[0]
  if (match) return { ...match, end: match.start + match.text.length }
  throw new Error('Word annotation does not match its source text')
}
