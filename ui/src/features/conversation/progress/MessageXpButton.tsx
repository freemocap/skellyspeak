import { XpArrivalContext } from './XpArrivalContext'
import { useContext, useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { XpEvidenceReport, xpReportCredits } from './XpEvidenceReport'

/** Explicit reports remain available when automatic XP effects are disabled. */
export function MessageXpButton({ messageId, source }: { messageId: number; source: string }) {
  const tr = useI18n()
  const { snapshot } = useContext(SkillEvidenceContext)
  const payout = useContext(XpArrivalContext)
  const practice = useContext(PracticeContext)
  const [open, setOpen] = useState(false)
  if (!snapshot || !practice?.chatId) return null
  const message = { chatId: practice.chatId, messageId, source }
  const total = xpReportCredits(snapshot, undefined, message).reduce((sum, row) => sum + row.credit.xp, 0)
  const points = payout?.arrivals.filter(item => item.messageId === messageId && item.source === source) ?? []
  const shown = Math.max(0, total - points.filter(item => !item.paid).length)
  return <>
    <span className="message-xp-anchor">
    <button data-message-xp type="button" className="message-translate" aria-label={tr('Message XP')} aria-haspopup="dialog" onClick={event => { event.stopPropagation(); setOpen(true) }}>{tr.number(shown)} {tr(' XP')}</button>
    <span className="message-xp-payout" aria-hidden="true">{points.filter(item => item.paid).map(item => <span className="message-xp-coin" key={item.key}>{'+'}{tr.number(1)}</span>)}</span>
    </span>
    {open && <XpEvidenceReport snapshot={snapshot} message={message} onClose={() => setOpen(false)} />}
  </>
}
