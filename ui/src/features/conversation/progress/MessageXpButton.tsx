import { useContext, useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { XpEvidenceReport, xpReportCredits } from './XpEvidenceReport'

/** Explicit reports remain available when automatic XP effects are disabled. */
export function MessageXpButton({ messageId, source }: { messageId: number; source: string }) {
  const tr = useI18n()
  const { snapshot } = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const [open, setOpen] = useState(false)
  if (!snapshot || !practice?.chatId) return null
  const message = { chatId: practice.chatId, messageId, source }
  const total = xpReportCredits(snapshot, undefined, message).reduce((sum, row) => sum + row.credit.xp, 0)
  return <>
    <button type="button" className="message-translate" aria-label={tr('Message XP')} aria-haspopup="dialog" onClick={event => { event.stopPropagation(); setOpen(true) }}>{tr.number(total)} {tr(' XP')}</button>
    {open && <XpEvidenceReport snapshot={snapshot} message={message} onClose={() => setOpen(false)} />}
  </>
}
