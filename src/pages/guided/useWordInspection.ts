import { useCallback, useEffect, useState } from 'react'
import type { PopupState } from '../../components/GlossPopup'

/// Which token in which bubble the breakdown is highlighting.
export interface InspectTarget {
  turn: number
  side: 'me' | 'bot'
  index: number
}

interface Options {
  /// Pin a turn so the breakdown pane shows it.
  pinTurn: (turnId: number) => void
  /// Whether the breakdown pane is open, and how to open it.
  breakOpen: boolean
  toggleBreak: () => void
}

/// Saved-word reveal and analysis selection state.
export function useWordInspection({ pinTurn, breakOpen, toggleBreak }: Options) {
  // Tap: the small gloss bubble anchored to the word.
  const [popup, setPopup] = useState<PopupState | null>(null)
  const closePopup = useCallback(() => setPopup(null), [])

  // Which tokens are showing their gloss.
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())

  // Right-click: highlight the token in the breakdown's word lists.
  const [inspect, setInspect] = useState<InspectTarget | null>(null)

  /// Drag across words adds them.
  const reveal = useCallback((keys: string[]) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      for (const k of keys) next.add(k)
      return next
    })
  }, [])

  /// Double-click toggles a whole bubble: reveal-all ⇄ hide-all.
  const toggleReveal = useCallback((keys: string[]) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      const allOn = keys.every((k) => prev.has(k))
      for (const k of keys) {
        if (allOn) next.delete(k)
        else next.add(k)
      }
      return next
    })
  }, [])

  const inspectWord = useCallback(
    (turnId: number, side: 'me' | 'bot', index: number) => {
      pinTurn(turnId)
      setInspect({ turn: turnId, side, index })
      if (!breakOpen) toggleBreak()
    },
    [pinTurn, breakOpen, toggleBreak]
  )

  // Scroll the highlighted token into view in the breakdown.
  useEffect(() => {
    if (!inspect) return
    document.querySelector('.tok.inspected')?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    })
  }, [inspect])

  /// Called when a different conversation takes the screen: none of this
  /// refers to anything still on it.
  const clear = useCallback(() => {
    setRevealed(new Set())
    setInspect(null)
    setPopup(null)
  }, [])

  return {
    popup,
    setPopup,
    closePopup,
    revealed,
    reveal,
    toggleReveal,
    inspect,
    inspectWord,
    clear,
  }
}
