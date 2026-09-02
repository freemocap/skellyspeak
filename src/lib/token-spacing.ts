/**
 * Typographic spacing for token streams from the structured LLM output.
 * LLM tokenizers emit punctuation both attached ("hoy?") and as separate
 * tokens ("hoy", "."). Join with spaces except where punctuation dictates.
 */

const NO_SPACE_BEFORE = /^[.!?,;:…»"')\]]/
const NO_SPACE_AFTER = /[¿¡«"(\[]$/

export function needsSpaceBetween(prev: string, next: string): boolean {
  if (!prev || !next) return false
  if (NO_SPACE_BEFORE.test(next)) return false
  if (NO_SPACE_AFTER.test(prev)) return false
  return true
}
