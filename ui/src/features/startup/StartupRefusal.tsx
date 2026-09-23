import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { useI18n } from '../../components/localization/i18n'
import { useState } from 'react'
import type { AppError } from '../../generated/contracts'
import { invoke } from '../../platform/ipc/tauri'
import { nativeError } from '../../platform/ipc/workspace'
import { ConfigurationRefusal } from './ConfigurationRefusal'
import { SaveDataCopy } from '../../components/persistence/SaveDataCopy'

/// The workspace could not be opened, so there is no store and no shell to show.
/// The learner gets the exact reason, a way to keep a copy of their data, and the
/// one action that recovers the app; typing a confirmation is not available when
/// the app that would ask for it cannot start.
export function StartupRefusal({ error }: { error: AppError }) {
  const tr = useI18n()
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
  if (error.code === 'config_load') return <ConfigurationRefusal message={error.message} />
  return <main className="startup-refusal">
    <ErrorNotice as="p" error={error}>{error.message}</ErrorNotice>
    {!ownedElsewhere && <SaveDataCopy />}
    <button type="button" className="btn danger" disabled={busy || ownedElsewhere}
      title={tr("Deletes all local data, including conversations, editable configuration files and saved keys, then closes the app.")}
      onClick={() => { void reset() }}>
      {busy ? tr("Resetting…") : tr("Factory Reset")}
    </button>
    {failure && <ErrorNotice as="p" error={failure}>{failure}</ErrorNotice>}
  </main>
}
