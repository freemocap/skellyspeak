import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CoachFeedback } from '../../types'
import { openOverlay } from '../../lib/back'
import { CoachEntry } from '../panes/CoachEntry'

export function MessageFeedback({ id, text, feedback, error, reviewing, targetLangCode, nativeLangCode, onEdit, onAsk }: {
  id: number; text: string; feedback: CoachFeedback | undefined; error: string | undefined
  reviewing: boolean; targetLangCode: string; nativeLangCode: string
  onEdit: (() => void) | undefined; onAsk: (question: string) => void
}) {
  const [open, setOpen] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    return openOverlay(() => setOpen(false))
  }, [open])
  const close = (): void => { dialog.current?.close(); setOpen(false) }
  return <>
    <button type="button" className={`feedback-badge${error ? ' feedback-error' : ''}`} aria-haspopup="dialog" aria-label={`Coach feedback for message ${id}`} onClick={() => setOpen(true)}>
      {error ? 'Feedback failed' : feedback ? `Understood ${feedback.comprehensibility}/5 · Grammar ${feedback.grammar}/5` : reviewing ? 'Coach reviewing…' : 'Feedback unavailable'} <span aria-hidden="true">↗</span>
    </button>
    {open && createPortal(<dialog ref={dialog} className="feedback-dialog" aria-labelledby={`feedback-title-${id}`} onCancel={() => setOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="feedback-heading"><h2 id={`feedback-title-${id}`}>Feedback on your message</h2><button className="lesson-action" type="button" onClick={close} aria-label="Close feedback">✕</button></div>
      {feedback || error ? <CoachEntry turn={{ id, user: text, coach: feedback, coachError: error }} targetLangCode={targetLangCode} nativeLangCode={nativeLangCode} onTerm={(term) => { close(); onAsk(`Explain “${term}” in my message: “${text}”`) }} /> : <><blockquote>{text}</blockquote><p role="status">{reviewing ? 'The coach is reviewing this message.' : 'No feedback was saved for this message.'}</p></>}
      <div className="lesson-actions"><button type="button" className="lesson-action" onClick={() => { close(); onAsk(`Help me understand the feedback on my message: “${text}”`) }}>Ask the coach</button><button type="button" className="lesson-action" disabled={!onEdit} onClick={() => { close(); onEdit?.() }}>Edit &amp; try again</button></div>
      <p className="lesson-meta">Editing replaces this attempt and its reply. If later turns exist, you’ll be asked before they are discarded.</p>
    </dialog>, document.body)}
  </>
}
