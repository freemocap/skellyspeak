/** Presentation only: the Source view always retains the original text. */
export function paragraphize(text: string): string {
  return text.split(/(\n\s*\n)/).map(block => {
    // Keep authored Markdown and multiline layout intact.
    if (block.length < 240 || /\n|^\s*(?:#|>|[-*] |\d+\. |```)/.test(block)) return block
    const sentences = [...new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(block)]
    return sentences.map(part => part.segment.trim()).join('\n\n')
  }).join('')
}

/** Locate complete embedded JSON, respecting quoted braces and escaped quotes. */
export function inspectionParts(text: string): Array<{ text: string } | { value: unknown }> {
  const parts: Array<{ text: string } | { value: unknown }> = []
  let start = 0
  let candidate = -1
  let quoted = false
  let escaped = false
  const stack: string[] = []
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (candidate < 0) {
      if (char !== '{' && char !== '[') continue
      candidate = i
      stack.push(char)
      continue
    }
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
      continue
    }
    if (char === '"') { quoted = true; continue }
    if (char === '{' || char === '[') stack.push(char)
    if (char !== '}' && char !== ']') continue
    const opening = stack.pop()
    if ((char === '}' && opening !== '{') || (char === ']' && opening !== '[')) {
      candidate = -1
      stack.length = 0
      continue
    }
    if (stack.length) continue
    try {
      const value: unknown = JSON.parse(text.slice(candidate, i + 1))
      if (candidate > start) parts.push({ text: text.slice(start, candidate) })
      parts.push({ value })
      start = i + 1
    } catch { /* Ordinary brackets or unfinished JSON remain literal text. */ }
    candidate = -1
  }
  if (start < text.length) parts.push({ text: text.slice(start) })
  return parts
}
