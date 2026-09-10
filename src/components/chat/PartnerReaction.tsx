import { TargetText } from '../TargetText'
import { useEffect, useRef, useState } from 'react'
import { playRewardSound } from '../../lib/reward-sounds'
import type { PartnerReaction as Reaction } from '../../types'
import { DetailDialog } from '../DetailDialog'

const reactions: Record<Reaction['kind'], { icon: string; label: string }> = {
  confused: { icon: '🤔?', label: 'Partner is unsure' },
  understood: { icon: '🙂', label: 'Partner understood' },
  curious: { icon: '🧐', label: 'Partner is curious' },
  surprised: { icon: '😮', label: 'Partner is surprised' },
  concerned: { icon: '😟', label: 'Partner is concerned' },
}

export function PartnerReaction({ reaction, error, message, reply, onEdit }: {
  reaction: Reaction | undefined
  error: string | undefined
  message: string
  reply: string
  onEdit: (() => void) | undefined
}) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const previous = useRef(reaction)
  useEffect(() => {
    const fresh = reaction && reaction !== previous.current
    previous.current = reaction
    if (fresh && !error && button.current && (reaction.kind === 'confused' || reaction.kind === 'understood')) {
      playRewardSound({ kind: reaction.kind }, button.current)
    }
  }, [reaction, error])
  if (!reaction && !error) return null
  const display = error ? { icon: '⚠', label: 'Partner reaction unavailable' } : reactions[reaction!.kind]
  return <>
    <button ref={button} type="button" className={`partner-reaction${reaction?.kind === 'confused' ? ' is-confused' : ''}`} aria-label={display.label} title={display.label} aria-haspopup="dialog" aria-expanded={open}
      onDoubleClick={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setOpen(true) }}>
      <span aria-hidden="true">{display.icon}</span>
    </button>
    {open && <DetailDialog title="Partner’s interpretation" onClose={() => setOpen(false)}>
      <div className="reaction-details">
        <h2><span aria-hidden="true">{display.icon} </span>{display.label}</h2>
        <section className="reaction-exchange" aria-label="Conversation exchange">
          <div className="reaction-excerpt learner"><span>Your message</span><div className="msg me plain" dir="auto"><TargetText text={message} /></div></div>
          <div className="reaction-excerpt partner"><span>Partner reply</span><div className="msg bot" dir="auto"><TargetText text={reply} /></div></div>
        </section>
        {error ? <p role="alert">{error}</p> : <>
          <h3>How I read your message</h3><p dir="auto">{reaction!.interpretation}</p>
          <h3>{reaction!.kind === 'confused' ? 'What was unclear' : 'Why this reaction'}</h3><p dir="auto">{reaction!.explanation}</p>
        </>}
        <button type="button" className="lesson-action" disabled={!onEdit} onClick={() => { setOpen(false); onEdit?.() }}>Edit &amp; try again</button>
        <p className="lesson-meta">The partner’s self-report can be wrong. This is not a proficiency score or a measured emotion.</p>
        <p className="lesson-meta">Editing replaces this attempt and its reply. You’ll be asked before later turns are discarded.</p>
      </div>
    </DetailDialog>}
  </>
}
