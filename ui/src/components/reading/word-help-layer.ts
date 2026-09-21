/** Touch WebViews can composite top-layer popovers at the wrong viewport scale.
 * Keep touch helpers in the document's coordinate system, outside scroll clips.
 * Inside a modal they must stay in that modal's layer to remain interactive. */
export function wordHelpLayer(anchor: HTMLElement | null) {
  const touch = anchor !== null && window.matchMedia('(pointer: coarse)').matches
  return { touch, host: anchor?.closest('dialog[open]') ?? document.body }
}

export function positionWordHelp(card: HTMLElement, word: HTMLElement) {
  const viewport = window.visualViewport
  const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0
  const width = viewport?.width ?? window.innerWidth, height = viewport?.height ?? window.innerHeight
  card.style.maxWidth = `${Math.max(0, Math.min(320, width - 16))}px`
  card.style.maxHeight = `${Math.max(0, height - 16)}px`
  const style = getComputedStyle(word)
  for (const name of ['--reading-scale', '--script-scale']) card.style.setProperty(name, style.getPropertyValue(name))
  const box = word.getBoundingClientRect(), size = card.getBoundingClientRect()
  const start = getComputedStyle(word).direction === 'rtl' ? box.right - size.width : box.left
  card.style.left = `${Math.max(left + 8, Math.min(start, left + width - size.width - 8))}px`
  const above = box.top - size.height - 4
  card.style.top = `${Math.max(top + 8, Math.min(above >= top + 8 ? above : box.bottom + 4, top + height - size.height - 8))}px`
}
