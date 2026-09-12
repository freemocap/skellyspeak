import { useEffect } from 'react'
import { fontSizeActionFromShortcut, type FontSizeAction } from '../../domain/input/font-size'
import { reportFault } from '../../platform/diagnostics/faults'
import { onReadingSizeAction } from '../../platform/ipc/reading-size'
import { isTauri } from '../../platform/ipc/tauri'

/// Reading size is a learner preference, not transient WebView zoom. Both the
/// keyboard and the native View menu call this one path.
export function useTextSizeShortcut(onChange: (action: FontSizeAction) => void): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return
      const action = fontSizeActionFromShortcut(event)
      if (!action) return
      event.preventDefault()
      onChange(action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChange])

  // The desktop menu owns its accelerators. Receiving its action here keeps
  // menu clicks and keyboard shortcuts identical while leaving web builds
  // with the keyboard handler above.
  useEffect(() => {
    if (!isTauri) return
    let disposed = false
    let unlisten: (() => void) | undefined
    void onReadingSizeAction(onChange)
      .then(stop => { if (disposed) stop(); else unlisten = stop })
      .catch(error => reportFault('Listening for text size menu actions', error))
    return () => { disposed = true; unlisten?.() }
  }, [onChange])
}
