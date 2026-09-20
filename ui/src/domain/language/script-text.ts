import { joiningRanges } from './joining-ranges'

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

/** Annotation boxes must not interrupt cursive joining or a combining/conjunct
 * cluster. Derive the capability from characters, never a language ID, so mixed
 * text and languages sharing a script follow the same rule. [@unicode17_joining]
 */
export function requiresWholeWordShaping(text: string): boolean {
  for (const character of text) {
    const codepoint = character.codePointAt(0)!
    if (joiningRanges.some(([start, end]) => codepoint >= start && codepoint <= end)) return true
  }
  return Array.from(graphemes.segment(text)).some(({ segment }) =>
    /[\p{L}\p{N}]/u.test(segment) && Array.from(segment).length > 1)
}

// Explanations combine source script, Latin reading aids and translated prose.
// This identifies script runs only; it does not infer their language identity.
const SOURCE = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}][\p{L}\p{M}\p{N}\u200c\u200d]*(?:[ \t]+[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}][\p{L}\p{M}\p{N}\u200c\u200d]*)*/gu
export function sourceScriptRuns(text: string) {
  return Array.from(text.matchAll(SOURCE), match => ({ text: match[0], start: match.index, end: match.index + match[0].length }))
}

/** A short script sample that never cuts a combining sequence or conjunct. */
export function languageBadgeSample(endonym: string): string {
  const count = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]/u.test(endonym) ? 2 : 1
  return Array.from(graphemes.segment(endonym)).slice(0, count).map(item => item.segment).join('')
}
