import { useEffect } from 'react'
import { comboFromEvent } from '../../domain/input/keyboard'

/// The configurable Settings shortcut (default ctrl+,). Disabled while a
/// language save is in flight so the modal cannot open over a pending write.
export function useSettingsShortcut({ enabled, shortcut, busy, onToggle }: {
  enabled: boolean
  shortcut: string
  busy: boolean
  onToggle: () => void
}): void {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (comboFromEvent(e) === shortcut) {
        e.preventDefault()
        if (!busy) onToggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, shortcut, busy, onToggle])
}
