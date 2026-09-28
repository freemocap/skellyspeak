/** Viewport origin of an absolute portal's containing block. Reading portals
 * live under the document, or inside the dialog/popover that owns their text. */
export function readingLayerOrigin(host: Element) {
  for (let parent: Element | null = host; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent)
    if ((style.position && style.position !== 'static') || (style.transform && style.transform !== 'none')) {
      const box = parent.getBoundingClientRect()
      return { left: box.left + parent.clientLeft - parent.scrollLeft, top: box.top + parent.clientTop - parent.scrollTop }
    }
  }
  return { left: -window.scrollX, top: -window.scrollY }
}
