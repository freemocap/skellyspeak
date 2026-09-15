import { useI18n } from '../../ui/i18n'
import type { Opening, StarterCard } from '../../contracts'
import { useRef, useState } from 'react'
import { nativeError } from '../../platform/ipc/workspace'

/** Native starter selection supplies all display text and provenance. */
export type StartChoice = Exclude<Opening, { kind: 'learner' }>

export function ConversationStart({ starters, busy, onStart, onLesson, partnerName }: {
  partnerName?: string
  onLesson?: () => void
  starters: StarterCard[]; busy: boolean
  onStart: (choice: StartChoice) => Promise<void>
}) {
  const tr = useI18n()
  const [topic, setTopic] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState<string | null>(null)
  async function start(choice: StartChoice) {
    if (busy || pending.current) return
    pending.current = true; setSubmitting(true); setError(null)
    try { await onStart(choice) }
    catch (reason) { setError(nativeError(reason)) }
    finally { pending.current = false; setSubmitting(false) }
  }
  const disabled = busy || submitting
  return <section className="conversation-start" aria-label={tr("Start a conversation")} aria-busy={submitting}>
    <span className="start-label">{tr("Start the conversation")}</span>
    <div className="start-partner-row"><button type="button" className="start-conversation-button" disabled={disabled}
      onClick={() => void start(topic ? { kind: 'starter', starterId: topic } : { kind: 'surprise' })}>
      {submitting ? tr("Starting…") : tr("Let {name} start", { name: partnerName ?? tr("partner") })}
    </button>
    {starters.length > 0 && <select className="start-topic" aria-label={tr("Topic")} value={topic} disabled={disabled} onChange={event => setTopic(event.target.value)}>
      <option value="">{tr("Any topic")}</option>
      {starters.map(starter => <option key={starter.id} value={starter.id}>{starter.label}</option>)}
    </select>}
    </div>
    {onLesson && <><span className="start-or">{tr("or")}</span><button type="button" disabled={disabled} onClick={onLesson}>{tr("Take a lesson")}</button></>}
    {starters.length === 0 && <p>{tr('No matching starter topics. You can still start a conversation.')}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
