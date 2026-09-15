import { create } from 'zustand'
import { useState } from 'react'
import type { AppError, StartupState } from '../../contracts'
import { nativeError } from '../../platform/ipc/workspace'
import { invoke } from '../../platform/ipc/tauri'
import { useI18n } from '../../ui/i18n'

export const useCredentialCleanup = create<{ error: AppError | null }>(() => ({ error: null }))

export function CredentialCleanup() {
  const tr = useI18n()
  const error = useCredentialCleanup(state => state.error)
  const [busy, setBusy] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  if (!error) return null
  async function retry() {
    setBusy(true)
    setRetryError(null)
    try {
      const startup = await invoke<StartupState>('retry_credential_cleanup')
      useCredentialCleanup.setState({ error: startup.credentialCleanup })
    } catch (error) {
      setRetryError(nativeError(error))
    } finally { setBusy(false) }
  }
  return <div className="fault-bar" role="alert">
    <p>{tr('Saved credential cleanup failed.')}: {error.message}</p>
    {retryError && <p>{retryError}</p>}
    <button type="button" className="btn" disabled={busy} onClick={() => void retry()}>{tr('Retry credential cleanup')}</button>
  </div>
}
