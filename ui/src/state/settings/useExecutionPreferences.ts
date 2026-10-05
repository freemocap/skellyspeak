import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from './settings'
import type { ExecutionMode, ExecutionPreferences } from '../../generated/contracts'
import { executionPreferencesChanged, onExecutionPreferencesChanged } from '../../platform/ipc/execution-preference-events'
import { reportFault } from '../../platform/diagnostics/faults'

/** One controller for workspace execution choices on both product surfaces. */
export function useExecutionPreferences() {
  const settings = useSettingsStore(state => state.settings)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    let disposed = false
    let stop: (() => void) | undefined
    void onExecutionPreferencesChanged(() => {
      void useSettingsStore.getState().load().catch(failure => { if (!disposed) setError(failure) })
    }).then(unlisten => { if (disposed) unlisten(); else stop = unlisten }).catch(failure => { if (!disposed) setError(failure) })
    return () => { disposed = true; stop?.() }
  }, [])
  async function change(feature: keyof ExecutionPreferences, mode: ExecutionMode) {
    if (!settings?.execution || pending.current) return
    pending.current = true; setBusy(true); setError(null)
    try {
      await useSettingsStore.getState().save({ ...settings, execution: { ...settings.execution, [feature]: mode } }, settings)
      void executionPreferencesChanged().catch(failure => reportFault('Refreshing execution preferences in other windows', failure))
    } catch (failure) { setError(failure) }
    finally { pending.current = false; setBusy(false) }
  }
  return { settings, busy, error, change, reload: () => { void useSettingsStore.getState().load().catch(setError) } }
}
