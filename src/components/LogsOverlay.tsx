import { useCallback, useEffect, useRef, useState } from 'react'
import { openDevWindow } from '../lib/tauri'
import { useIsMobile } from '../hooks/useIsMobile'
import { openOverlay } from '../lib/back'
import { DevPanel } from './dev/DevPanel'
import { reportFault } from '../lib/faults'

// The docked observability panel: a toggle button that pulls a resizable
// sheet up from the bottom, and a pop-out into its own OS window.
//
// Desktop only. Below the mobile breakpoint the same DevPanel becomes a
// third swipe surface inside GuidedPage (chat ⇄ coach ⇄ dev), because a
// bottom sheet over a phone-sized chat is unusable and Tauri mobile has no
// second window to pop out to.

const HEIGHT_KEY = 'skellyspeak_dev_h'
const MIN_VH = 18
// The panel pushes the app up rather than covering it, so the ceiling has to
// leave a usable conversation behind it.
const MAX_VH = 80
const DEFAULT_VH = 40

function storedHeight(): number {
  const raw = Number(localStorage.getItem(HEIGHT_KEY))
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_VH
  // Clamp rather than discard: a height saved under an older, taller ceiling
  // should come back as tall as still allowed, not snap to the default.
  return Math.min(MAX_VH, Math.max(MIN_VH, raw))
}

export function LogsOverlay() {
  const [open, setOpen] = useState(false)
  const [poppedOut, setPoppedOut] = useState(false)
  const [heightVh, setHeightVh] = useState<number>(storedHeight)
  const isMobile = useIsMobile()
  const dragging = useRef(false)

  // Android back closes the panel instead of exiting the app.
  useEffect(() => (open ? openOverlay(() => setOpen(false)) : undefined), [open])

  // Drag the top edge. Pointer events (not mouse) so a trackpad, a pen and a
  // touch screen all behave the same.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    const move = (ev: PointerEvent) => {
      if (!dragging.current) return
      const vh = ((window.innerHeight - ev.clientY) / window.innerHeight) * 100
      const clamped = Math.min(MAX_VH, Math.max(MIN_VH, vh))
      setHeightVh(clamped)
    }
    const up = () => {
      dragging.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setHeightVh((h) => {
        localStorage.setItem(HEIGHT_KEY, String(Math.round(h)))
        return h
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  const popOut = useCallback(() => {
    void openDevWindow()
      .then(() => {
        setPoppedOut(true)
        setOpen(false)
      })
      .catch((e: unknown) => reportFault('Observability window', e))
  }, [])

  // On mobile the panel is a swipe surface inside GuidedPage, not an overlay.
  if (isMobile) return null

  return (
    <>
      <button
        type="button"
        className={`logs-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Observability: graph, runs, logs"
        aria-label="Toggle observability panel"
      >
        {open ? '▾' : 'dev'}
      </button>
      {open && (
        <div className="logs-panel" style={{ height: `${heightVh}dvh` }}>
          <div
            className="logs-resize"
            onPointerDown={onPointerDown}
            role="separator"
            aria-label="Resize panel"
            title="Drag to resize"
          />
          <div className="logs-window-bar">
            <span className="logs-window-title">
              observability
              {poppedOut && <em> · also open in its own window</em>}
            </span>
            <button
              type="button"
              className="logs-clear"
              onClick={popOut}
              title="Open in a separate window"
            >
              pop out ⧉
            </button>
          </div>
          <DevPanel />
        </div>
      )}
    </>
  )
}
