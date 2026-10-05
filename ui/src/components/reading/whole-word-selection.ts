import { wholeWordRange } from '../../domain/reading/word-boundaries'

/** Map the actual occurrence through source-only nodes, excluding reading aids.
 * Never guess offsets by searching for the selected substring. */
export function wholeWordSelection(root: Element, text: string, selection: Selection | null): string | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const nodes = Array.from(root.querySelectorAll('[data-speech-source]'))
    .filter(element => {
      const helper = element.closest('[data-reading-tools], .saved-word-help, dialog')
      return !helper || !root.contains(helper)
    })
    .flatMap(element => Array.from(element.childNodes).filter((node): node is Text => node.nodeType === Node.TEXT_NODE))
  if (nodes.map(node => node.data).join('') !== text) return null
  const offset = (container: Node, position: number) => {
    if (container.nodeType === Node.TEXT_NODE && !nodes.includes(container as Text)) return null
    const point = document.createRange(); point.setStart(container, position); point.collapse(true)
    let cursor = 0
    for (const node of nodes) {
      if (node === container) return cursor + position
      if (point.comparePoint(node, node.length) <= 0) cursor += node.length
      else break
    }
    return cursor
  }
  const start = offset(range.startContainer, range.startOffset), end = offset(range.endContainer, range.endOffset)
  if (start === null || end === null || start === end) return null
  const locale = root.querySelector('[lang]')?.getAttribute('lang') || undefined
  const expanded = wholeWordRange(text, start, end, locale)
  const locate = (position: number, atStart = false) => {
    let cursor = 0
    for (const node of nodes) {
      if (position < cursor + node.length || (!atStart && position === cursor + node.length)) return { node, offset: position - cursor }
      cursor += node.length
    }
    return { node: nodes[nodes.length - 1], offset: nodes[nodes.length - 1].length }
  }
  if (expanded.start !== start || expanded.end !== end) {
    const first = locate(expanded.start, true), last = locate(expanded.end)
    const backward = selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset
    selection.setBaseAndExtent(backward ? last.node : first.node, backward ? last.offset : first.offset,
      backward ? first.node : last.node, backward ? first.offset : last.offset)
  }
  return text.slice(expanded.start, expanded.end)
}
