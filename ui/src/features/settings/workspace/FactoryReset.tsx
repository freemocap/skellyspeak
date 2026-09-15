import { useI18n } from '../../../components/localization/i18n'
import { useRef, useState } from 'react'
import { invoke } from '../../../platform/ipc/tauri'
import { SaveDataCopy } from '../../../components/persistence/SaveDataCopy'

export function FactoryReset() {
  const tr = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const erase = async () => {
    if (confirmation !== 'DELETE' || busy) return
    setBusy(true)
    setError(null)
    try { await invoke('factory_reset', { confirmation }) }
    catch (failure) { setError(String(failure)); setBusy(false) }
  }
  return <>
    <button type="button" className="btn danger" onClick={() => { setConfirmation(''); setError(null); dialog.current!.showModal() }}>{tr("Delete my data and close")}</button>
    <dialog ref={dialog} className="factory-reset-dialog" aria-labelledby="factory-reset-title" onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) event.currentTarget.close()
    }}>
      <h2 id="factory-reset-title">{tr("Delete all local data?")}</h2>
      <p>{tr("This permanently removes all conversations, lesson plans, coach memory, skill evidence and progress, settings, editable configuration files, saved API keys, sign-in credentials, logs, and layout preferences on this device.")}</p>
      <p><strong>{tr("This cannot be undone.")}</strong> {tr(" Your cloud account, billing and usage records, and files exported outside the app’s storage are not deleted.")}</p>
      <p>{tr("The app will close. Reopen SkellySpeak to complete the reset and start with factory defaults.")}</p>
      <p>{tr("Keep a copy first if you might want your conversations and progress later:")}</p>
      <SaveDataCopy />
      <label htmlFor="factory-reset-confirmation">{tr("Type ")}<strong>{tr("DELETE")}</strong> {tr(" to confirm")}</label>
      <input id="factory-reset-confirmation" autoComplete="off" spellCheck={false} value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} />
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="btn" autoFocus disabled={busy} onClick={() => dialog.current!.close()}>{tr("Cancel")}</button>
        <button type="button" className="btn danger" disabled={confirmation !== 'DELETE' || busy} onClick={() => void erase()}>{busy ? tr("Closing…") : tr("Delete all data and close")}</button>
      </div>
    </dialog>
  </>
}
