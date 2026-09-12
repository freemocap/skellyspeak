import { ActivityIndicator } from '../../ui/ActivityIndicator'
import { InfoTip } from '../../ui/InfoTip'
import { TargetText } from '../../ui/TargetText'
import { useState, type ReactNode } from 'react'
import { DetailDialog } from '../../ui/DetailDialog'
import type { Feedback } from '../../contracts'
import { CoachEntry } from './CoachEntry'

const score = (value: number | null): string => value === null ? '—' : `${value}/5`

export function MessageFeedback({ id, text, feedback, error, reviewing, onEdit, onAsk, children }: {
  children?: ReactNode
  id: number; text: string; feedback: Feedback | undefined; error: string | undefined
  reviewing: boolean
  onEdit: (() => void) | undefined; onAsk: (question: string) => void
}) {
  const [open, setOpen] = useState(false)
  const close = (): void => setOpen(false)
  return <>
    <button type="button" className={`feedback-badge${error ? ' feedback-error' : ''}`} title={feedback?.explanation || 'Coach feedback on this message'} aria-haspopup="dialog" aria-label={`Coach feedback for message ${id}`} onClick={() => setOpen(true)}>
      {error ? 'Feedback failed' : feedback ? `Correctness ${score(feedback.correctness)} · Understanding ${score(feedback.understandability)}` : reviewing ? <ActivityIndicator label="Analyzing…" /> : 'Feedback unavailable'} <span aria-hidden="true">↗</span>
    </button>
    <div className="message-actions" onDoubleClick={event => event.stopPropagation()}><button type="button" className="message-translate" aria-label="Analyze your message" aria-haspopup="dialog" onClick={() => setOpen(true)}>Analysis</button>{children}</div>
    {open && <DetailDialog title="Feedback on your message" onClose={close}>
      <strong>Feedback</strong><InfoTip>Correctness and understandability describe this message; these are model judgments, not validated measurements. Skill XP is assessed separately.</InfoTip>
      {feedback || error ? <CoachEntry turn={{ id, user: text, coach: feedback, coachError: error }} onTerm={(term) => { close(); onAsk(`Explain “${term}” in my message: “${text}”`) }} /> : <><blockquote><TargetText text={text} /></blockquote><p role="status">{reviewing ? 'The coach is reviewing this message.' : 'No feedback was saved for this message.'}</p></>}
      <div className="lesson-actions">
        <button type="button" className="lesson-action" onClick={() => { close(); onAsk(`Help me understand the feedback on my message: “${text}”`) }}>Ask the coach</button>
        {onEdit && <button type="button" className="lesson-action" onClick={() => { close(); onEdit() }}>Edit &amp; try again</button>}
      </div>
    </DetailDialog>}
  </>
}
