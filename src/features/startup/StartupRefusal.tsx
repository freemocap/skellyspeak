import { useState } from 'react'
import type { AppError } from '../../contracts'
import { invoke } from '../../platform/ipc/tauri'
import { nativeError } from '../../platform/ipc/workspace'
import { SaveDataCopy } from '../../ui/SaveDataCopy'

/// The workspace could not be opened, so there is no store and no shell to show.
/// The learner gets the exact reason, a way to keep a copy of their data, and the
/// one action that recovers the app; typing a confirmation is not available when
/// the app that would ask for it cannot start.
export function StartupRefusal({ error }: { error: AppError }) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const ownedElsewhere = error.code === 'conflict'
  const reset = async () => {
    if (busy || ownedElsewhere) return
    setBusy(true)
    setFailure(null)
    try { await invoke('factory_reset', { confirmation: 'DELETE' }) }
    catch (reason) { setFailure(nativeError(reason)); setBusy(false) }
  }
  return <main className="startup-refusal">
    <p role="alert">{error.message}</p>
    {!ownedElsewhere && <SaveDataCopy />}
    <button type="button" className="btn danger" disabled={busy || ownedElsewhere}
      title="Deletes all local data, including conversations and saved keys, then closes the app."
      onClick={() => { void reset() }}>
      {busy ? 'Resetting…' : 'Factory Reset'}
    </button>
    {failure && <p role="alert">{failure}</p>}
  </main>
}
