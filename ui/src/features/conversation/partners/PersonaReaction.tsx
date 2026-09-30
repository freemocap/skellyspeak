import { TargetPassage } from '../../../components/reading/TargetPassage'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import type { WordGlossView } from '../../../generated/contracts'
import { useI18n } from '../../../components/localization/i18n'
import { useEffect, useRef, useState } from 'react'
import { playRewardSound } from '../../../platform/audio/reward-sounds'
import type { PersonaReaction as Reaction } from '../../../types'
import { AskCoachButton } from '../../../components/learning/AskCoachButton'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { ToolbarIcon, type ToolbarIconName } from '../../../components/controls/ToolbarIcon'

const reactions: Record<Reaction['kind'], { icon: ToolbarIconName; label: string }> = {
  understood: { icon: 'smile', label: 'Partner understood' },
  confused: { icon: 'confused', label: 'Partner misunderstood' },
}

export function PersonaReaction({ reaction, error, message, reply, onEdit, userGloss, replyGloss }: {
  userGloss?: WordGlossView | null
  replyGloss?: WordGlossView | null
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
    if (fresh && !error && button.current && reaction.kind === 'understood') {
      playRewardSound({ kind: 'understood' }, button.current)
    }
  }, [reaction, error])
  if (!reaction && !error) return null
  const display: { icon: ToolbarIconName; label: string } = error ? { icon: 'alert', label: 'Partner reaction unavailable' } : reactions[reaction!.kind]
  return <>
    <button ref={button} type="button" className="persona-reaction" data-reaction={error ? 'unavailable' : reaction!.kind} aria-label={tr(display.label)} title={tr(display.label)} aria-haspopup="dialog" aria-expanded={open}
      onDoubleClick={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setOpen(true) }}>
      <ToolbarIcon name={display.icon} size={18} />
    </button>
    {open && <DetailDialog title={tr("Partner reaction")} onClose={() => setOpen(false)}>
      <div className="reaction-details">
        <h2 className="reaction-heading"><ToolbarIcon name={display.icon} size={20} />{tr(display.label)}</h2>
        <section className="reaction-exchange" aria-label={tr("Conversation exchange")}>
          <div className="reaction-excerpt learner"><span>{tr("Your message")}</span><TargetPassage text={message} side="me" segments={userGloss?.segments} /></div>
          <div className="reaction-excerpt persona"><span>{tr("Partner reply")}</span><TargetPassage text={reply} segments={replyGloss?.segments} /></div>
        </section>
        {error ? <ErrorNotice as="p" error={error}>{error}</ErrorNotice> : <>
          <AskCoachButton onClose={()=>setOpen(false)} question={`Explain the saved understanding category for this exchange. My message: ${message}. Partner reply: ${reply}. Assessment: ${JSON.stringify(reaction)}`} />
          <details><summary>{tr('Assessment details')}</summary><pre>{JSON.stringify(reaction!.answer, null, 2)}</pre></details>
        </>}
        <button type="button" className="detail-action" disabled={!onEdit} onClick={() => { setOpen(false); onEdit?.() }}>{tr("Edit & try again")}</button>
        <p className="detail-meta">{tr("This is an interpretation of the reply, not a measured emotion.")}</p>

      </div>
    </DetailDialog>}
  </>
}
