// Each transient layer owns one history entry. UI closes serialize with browser
// popstate so replacing a popover with a dialog cannot consume the new dialog.
const entries = new Map<number, () => void>()
const pending: number[] = []
let nextKey = 1
let current: number | null = null
let closing = false
let armed = false

function push(key: number): void {
  current = key
  history.pushState({ skellyspeak: key }, '')
}
function arm(): void {
  if (armed) return
  armed = true
  window.addEventListener('popstate', event => {
    const left = current
    current = (event.state as { skellyspeak?: number } | null)?.skellyspeak ?? null
    if (closing) closing = false
    else if (left !== null) {
      const close = entries.get(left)
      entries.delete(left)
      close?.()
    }
    // A parent may have unmounted while a child was on top.
    if (current !== null && !entries.has(current)) { closing = true; history.back(); return }
    for (const key of pending.splice(0)) if (entries.has(key)) push(key)
  })
}
export function openOverlay(closer: () => void): () => void {
  arm()
  const key = nextKey++
  entries.set(key, closer)
  if (closing) pending.push(key)
  else push(key)
  return () => {
    if (!entries.delete(key)) return
    if (current === key && !closing) { closing = true; history.back() }
  }
}
