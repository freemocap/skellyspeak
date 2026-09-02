import { useEffect } from 'react'

export interface PopupState {
  text: string
  /// Romanized form of the word, when the target uses a non-Latin script.
  romanization?: string | null
  x: number
  y: number
}

/// Anchor a popup above `el`, clamped so the card never clips the viewport
/// edges on narrow screens.
export function popupAnchor(el: Element): { x: number; y: number } {
  const rect = el.getBoundingClientRect()
  const half = Math.min(170, window.innerWidth / 2 - 8)
  const x = Math.min(Math.max(rect.left + rect.width / 2, half), window.innerWidth - half)
  return { x, y: Math.max(rect.top - 8, 56) }
}

export function GlossPopup({ popup, onClose }: { popup: PopupState; onClose: () => void }) {
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[data-gloss-popup]') || target.closest('[data-gloss-trigger]')) return
      onClose()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [onClose])

  return (
    <div data-gloss-popup="1" className="popup" style={{ left: popup.x, top: popup.y }}>
      <div className="popup-card">
        <span>
          {popup.text}
          {popup.romanization && (
            <span className="popup-roman"> · {popup.romanization}</span>
          )}
        </span>
        <button type="button" className="popup-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
    </div>
  )
}
