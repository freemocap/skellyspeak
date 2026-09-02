// Android back button = webview history back (wry routes it there when
// history exists). Standard SPA overlay pattern: pushing a history entry
// per overlay makes BACK close the topmost overlay instead of exiting the
// app. With no overlays open there are no entries, so back exits normally.

const entries = new Map<number, () => void>()
let nextKey = 1
let current: number | null = null
let suppress = 0
let armed = false

function arm() {
  if (armed) return
  armed = true
  window.addEventListener('popstate', (e) => {
    const target = (e.state as { skellyspeak?: number } | null)?.skellyspeak ?? null
    const left = current
    current = target
    if (suppress > 0) {
      // This pop is the echo of a UI-initiated close — already handled.
      suppress -= 1
      return
    }
    if (left !== null) {
      const closer = entries.get(left)
      if (closer) {
        entries.delete(left)
        closer()
      }
    }
  })
}

/// Register an overlay. Returns the UI-close function (idempotent): call it
/// when the overlay closes through its own UI. The back button will also
/// close the overlay by invoking the same closer.
export function openOverlay(closer: () => void): () => void {
  arm()
  const key = nextKey++
  entries.set(key, closer)
  current = key
  history.pushState({ skellyspeak: key }, '')
  return () => uiClose(key)
}

function uiClose(key: number) {
  const closer = entries.get(key)
  if (!closer) return
  if (current === key) {
    // Topmost: consume our history entry; the echo popstate is suppressed.
    entries.delete(key)
    suppress += 1
    current = null
    history.back()
  } else {
    // Mid-stack (rare): its entry becomes a lazy no-op shell.
    entries.delete(key)
  }
}
