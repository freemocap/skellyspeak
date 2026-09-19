import { useEffect } from 'react'
import { onAiWindowEvent } from '../platform/ipc/window'
import { reportFault } from '../platform/diagnostics/faults'
import { useAiWindowStore } from '../state/navigation/ai-window'
import { useNavigationStore } from '../state/navigation/navigation'

/// Keep the main window's idea of the AI window in step with native. The state
/// is re-read on mount, on focus and on every hint event; a pop-in also
/// reopens the docked panel.
export function useAiWindowSync() {
  useEffect(() => {
    const refresh = () => { useAiWindowStore.getState().refresh().catch(error => reportFault('Reading the AI window state', error)) }
    refresh()
    window.addEventListener('focus', refresh)
    let stop: (() => void) | null = null
    let disposed = false
    onAiWindowEvent(event => {
      if (event === 'docked') useNavigationStore.getState().showOverlay('activity')
      refresh()
    }).then(unlisten => { if (disposed) unlisten(); else stop = unlisten })
      .catch(error => reportFault('Listening for the AI window', error))
    return () => { disposed = true; window.removeEventListener('focus', refresh); stop?.() }
  }, [])
}
