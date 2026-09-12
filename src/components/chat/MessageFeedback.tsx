import { ActivityIndicator } from '../ActivityIndicator'
import { InfoTip } from '../InfoTip'
import { TargetText } from '../TargetText'
import { useState, type ReactNode } from 'react'
import { DetailDialog } from '../DetailDialog'
import type { CoachFeedback } from '../../types'
import { CoachEntry } from '../panes/CoachEntry'

export function MessageFeedback({ id, text, feedback, error, reviewing, targetLangCode, nativeLangCode, onEdit, onAsk, children }: {
  children?: ReactNode
  id: number; text: string; feedback: CoachFeedback | undefined; error: string | undefined
  reviewing: boolean; targetLangCode: string; nativeLangCode: string
  onEdit: (() => void) | undefined; onAsk: (question: string) => void
}) {
  const [open, setOpen] = useState(false)
  const close = (): void => setOpen(false)
  return <>
    <button type="button" className={`feedback-badge${error ? ' feedback-error' : ''}`} title={feedback?.remark || 'Coach assessment of grammar and understanding'} aria-haspopup="dialog" aria-label={`Coach feedback for message ${id}`} onClick={() => setOpen(true)}>
      {error ? 'Feedback failed' : feedback ? `Grammar ${feedback.grammar === null ? '—' : `${feedback.grammar}/5`}${feedback.conversation !== undefined ? ` · Understanding ${feedback.conversation === null ? '—' : `${feedback.conversation}/5`}` : ""}` : reviewing ? <ActivityIndicator label="Analyzing…" /> : 'Feedback unavailable'} <span aria-hidden="true">↗</span>
    </button>
    <div className="message-actions" onDoubleClick={event => event.stopPropagation()}><button type="button" className="message-translate" aria-label="Analyze your message" aria-haspopup="dialog" onClick={() => setOpen(true)}>Analysis</button>{children}</div>
    {open && <DetailDialog title="Feedback on your message" onClose={close}>
      <strong>Feedback</strong><InfoTip>Correctness and conversational fit describe this message; these are model judgments, not validated measurements. Skill XP is assessed separately.</InfoTip>
      {feedback || error ? <CoachEntry turn={{ id, user: text, coach: feedback, coachError: error }} targetLangCode={targetLangCode} nativeLangCode={nativeLangCode} onTerm={(term) => { close(); onAsk(`Explain “${term}” in my message: “${text}”`) }} /> : <><blockquote><TargetText text={text} /></blockquote><p role="status">{reviewing ? 'The coach is reviewing this message.' : 'No feedback was saved for this message.'}</p></>}
      <div className="lesson-actions"><button type="button" className="lesson-action" onClick={() => { close(); onAsk(`Help me understand the feedback on my message: “${text}”`) }}>Ask the coach</button><button type="button" className="lesson-action" disabled={!onEdit} onClick={() => { close(); onEdit?.() }}>Edit &amp; try again</button></div>
      <InfoTip>Editing replaces this attempt and its reply. If later turns exist, you’ll be asked before they are discarded.</InfoTip>
      <section className="analysis-placeholder" aria-label="Detailed analysis">
        <strong>Detailed analysis</strong>
        <p>Additional language analysis will appear here.</p>
      </section>
    </DetailDialog>}
  </>
}
