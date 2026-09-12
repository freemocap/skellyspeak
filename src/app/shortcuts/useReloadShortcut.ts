import { useEffect } from 'react'
import { isReloadShortcut } from '../../domain/input/reload'

/// Desktop webviews do not consistently supply a browser-style refresh
/// command. Own the familiar shortcut at the app shell so it works on every
/// screen, including when a field has focus.
export function useReloadShortcut(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isReloadShortcut(event)) return
      event.preventDefault()
      window.location.reload()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
