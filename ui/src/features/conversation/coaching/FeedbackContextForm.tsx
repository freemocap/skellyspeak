import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { InfoTip } from '../../../components/controls/InfoTip'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { nativeError } from '../../../platform/ipc/workspace'

export function FeedbackContextForm({ saved, reviewing, onSubmit }: { saved?: string; reviewing: boolean; onSubmit: (note: string) => Promise<void> }) {
  const tr = useI18n()
  const [note, setNote] = useState(saved ?? '')
  const [focused, setFocused] = useState(false)
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setNote(saved ?? '') }, [saved])
  return <form className="feedback-context" onSubmit={async event => {
      event.preventDefault()
      if (busy.current || reviewing || !note.trim()) return
      busy.current = true; setPending(true); setError(null)
      try { await onSubmit(note.trim()) }
      catch (reason) { setError(nativeError(reason)) }
      finally { busy.current = false; setPending(false) }
    }}>
      <div className="form-row"><textarea aria-label={tr('Add context')} placeholder={tr('Add context')} className="field" rows={focused || note ? 3 : 1} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} value={note} maxLength={2000} disabled={pending} onChange={event => setNote(event.target.value)} /></div>
      <div className="detail-actions"><button className="btn" type="submit" disabled={pending || reviewing || !note.trim()}>{tr('Reassess with context')}</button><InfoTip>{tr('Clarify your intended meaning or a transcription mistake. Reassesses this message without changing its text or XP.')}</InfoTip></div>
      {(pending || reviewing) && <p role="status">{tr('The coach is reviewing this message.')}</p>}
      {error && <ErrorNotice as="p" className="turn-errors" dismissible={false} error={error}>{error}</ErrorNotice>}
  </form>
}
