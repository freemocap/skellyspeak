import type { GuidedToken } from '../types'

// Tokens carry their trailing punctuation ("hoy?"), so a token ending in
// terminal punctuation closes its sentence.
const TERMINAL_PUNCT = /[.!?…]$/

export function groupSentences(tokens: GuidedToken[]): GuidedToken[][] {
  const sentences: GuidedToken[][] = [[]]
  for (const tok of tokens) {
    sentences[sentences.length - 1].push(tok)
    if (TERMINAL_PUNCT.test(tok.text)) sentences.push([])
  }
  if (sentences[sentences.length - 1].length === 0) sentences.pop()
  return sentences
}

// Split a translation into sentences the same way, so index i of the
// translation aligns with sentence i of the token stream. Models do not
// guarantee matching sentence counts, so callers must handle an index with
// no counterpart; TurnView shows the whole translation in that case.
export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]*/g) ?? []).map((s) => s.trim()).filter(Boolean)
}
