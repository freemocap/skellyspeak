import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useState } from 'react'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { useI18n } from '../../../components/localization/i18n'
import { nativeError } from '../../../platform/ipc/workspace'
export function CustomTopicDialog({ initial, onUse, onClose }: { initial: string; onUse: (text: string, save: boolean) => Promise<void>; onClose: () => void }) {
  const tr = useI18n()
  const [text, setText] = useState(initial)
  const [save, setSave] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return <DetailDialog title={tr('Suggest a topic')} onClose={() => { if (!busy) onClose() }}><form className="prompt-creator" onSubmit={async event => {
    event.preventDefault()
    if (busy) return
    const clean = text.trim()
    if (!clean || [...clean].length > 500 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(clean)) { setError(tr('Enter a topic of 1–500 characters.')); return }
    setBusy(true); setError(null)
    try { await onUse(clean, save); onClose() } catch (reason) { setError(nativeError(reason)) } finally { setBusy(false) }
  }}><h2>{tr('Suggest a topic')}</h2><label>{tr('Topic')}<textarea autoFocus className="field" value={text} disabled={busy} onChange={event => setText(event.target.value)} /></label>
    <label><input type="checkbox" checked={save} disabled={busy} onChange={event => setSave(event.target.checked)} /> {tr('Save for later')}</label>
    {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}<div className="prompt-actions"><button className="btn" type="button" disabled={busy} onClick={onClose}>{tr('Cancel')}</button><button className="btn primary" disabled={busy}>{tr('Use topic')}</button></div>
  </form></DetailDialog>
}
