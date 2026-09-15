import { useI18n } from '../../ui/i18n'
import { TargetText } from '../../ui/TargetText'
import { useEffect, useRef, useState } from 'react'
import { playRewardSound } from '../../platform/audio/reward-sounds'
import type { PersonaReaction as Reaction } from '../../types'
import { DetailDialog } from '../../ui/DetailDialog'

const reactions: Record<Reaction['kind'], { icon: string; label: string }> = {
  happy: { icon: '😊', label: 'Partner seems happy' },
  sad: { icon: '😔', label: 'Partner seems sad' },
  angry: { icon: '😠', label: 'Partner seems angry' },
  confused: { icon: '🤔?', label: 'Partner seems unsure' },
  understood: { icon: '🙂', label: 'Partner seems to understand' },
  curious: { icon: '🧐', label: 'Partner seems curious' },
  surprised: { icon: '😮', label: 'Partner seems surprised' },
  concerned: { icon: '😟', label: 'Partner seems concerned' },
}

export function PersonaReaction({ reaction, error, message, reply, onEdit }: {
  reaction: Reaction | undefined
  error: string | undefined
  message: string
  reply: string
  onEdit: (() => void) | undefined
}) {
  const tr = useI18n()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const previous = useRef(JSON.stringify(reaction))
  useEffect(() => {
    const fresh = reaction && JSON.stringify(reaction) !== previous.current
    previous.current = JSON.stringify(reaction)
    if (fresh && !error && button.current && (reaction.kind === 'confused' || reaction.kind === 'understood' || reaction.kind === 'happy')) {
      playRewardSound({ kind: reaction.kind === 'happy' ? 'understood' : reaction.kind }, button.current)
    }
  }, [reaction, error])
  if (!reaction && !error) return null
  const display = error ? { icon: '⚠', label: 'Partner reaction unavailable' } : reactions[reaction!.kind]
  return <>
    <button ref={button} type="button" className={`persona-reaction${reaction?.kind === 'confused' ? ' is-confused' : ''}`} aria-label={display.label} title={display.label} aria-haspopup="dialog" aria-expanded={open}
      onDoubleClick={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setOpen(true) }}>
      <span aria-hidden="true">{display.icon}</span>
    </button>
    {open && <DetailDialog title={tr("Partner reaction")} onClose={() => setOpen(false)}>
      <div className="reaction-details">
        <h2><span aria-hidden="true">{display.icon} </span>{display.label}</h2>
        <section className="reaction-exchange" aria-label={tr("Conversation exchange")}>
          <div className="reaction-excerpt learner"><span>{tr("Your message")}</span><div className="msg me plain" dir="auto"><TargetText text={message} /></div></div>
          <div className="reaction-excerpt persona"><span>{tr("Partner reply")}</span><div className="msg bot" dir="auto"><TargetText text={reply} /></div></div>
        </section>
        {error ? <p role="alert">{error}</p> : <>
          <h3>{tr("How your message came across")}</h3><p dir="auto">{reaction!.interpretation}</p>
          <h3>{reaction!.kind === 'confused' ? tr("What was unclear") : tr("Why this reaction")}</h3><p dir="auto">{reaction!.explanation}</p>
        </>}
        <button type="button" className="lesson-action" disabled={!onEdit} onClick={() => { setOpen(false); onEdit?.() }}>{tr("Edit & try again")}</button>
        <p className="lesson-meta">{tr("This is an interpretation of the reply, not a measured emotion.")}</p>

      </div>
    </DetailDialog>}
  </>
}
