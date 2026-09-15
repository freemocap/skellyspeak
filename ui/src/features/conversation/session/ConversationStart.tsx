import { PersonaAvatar } from '../../../components/media/PersonaAvatar'
import { useI18n } from '../../../components/localization/i18n'
import type { Opening, StarterCard } from '../../../generated/contracts'
import { useRef, useState } from 'react'
import { nativeError } from '../../../platform/ipc/workspace'

/** Native starter selection supplies all display text and provenance. */
export type StartChoice = Exclude<Opening, { kind: 'learner' }>

export function ConversationStart({ starters, busy, onStart, partnerName, partnerSymbol }: {
  partnerName?: string
  partnerSymbol?: string
  onLesson?: () => void
  starters: StarterCard[]; busy: boolean
  onStart: (choice: StartChoice) => Promise<void>
}) {
  const tr = useI18n()
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
    <PersonaAvatar symbol={partnerSymbol} />
    {partnerName && <h2>{partnerName}</h2>}
    <button type="button" className="start-conversation-button" disabled={disabled}
      onClick={() => void start({ kind: 'surprise' })}>
      {submitting ? tr("Starting…") : tr("Let {name} start", { name: partnerName ?? tr("partner") })}
    </button>
    <span className="start-hint">{tr("or send a message below")}</span>
    {starters.length > 0 && <>
      <span className="start-or">{tr("or pick a topic")}</span>
      <div className="start-topics">{starters.slice(0, 3).map(starter =>
        <button type="button" className="start-topic" key={starter.id} disabled={disabled}
          onClick={() => void start({ kind: 'starter', starterId: starter.id })}>
          <strong>{starter.label}</strong><span>{starter.reason}</span>
        </button>)}</div>
    </>}
    {error && <p role="alert">{error}</p>}
  </section>
}
