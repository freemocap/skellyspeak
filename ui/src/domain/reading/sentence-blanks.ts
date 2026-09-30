/** Known templates allow underscore slots next to words; ordinary text requires standalone runs.
 * Keep the original text and UTF-16 offsets; surrounding scripts do not matter. */
export function sentenceBlanks(text: string, template = false) {
  return Array.from(text.matchAll(template ? /_+/gu : /(?<![\p{L}\p{M}\p{N}\p{Pc}])_+(?![\p{L}\p{M}\p{N}\p{Pc}])/gu), match => ({
    start: match.index, end: match.index + match[0].length,
  }))
}

export function isSentenceBlank(text: string, start: number, end: number, template = false) {
  return sentenceBlanks(text, template).some(blank => blank.start === start && blank.end === end)
}
