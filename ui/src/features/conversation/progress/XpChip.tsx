import { useContext, useRef, useState, type RefObject } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useOverlayLayer } from '../../../components/dialogs/useOverlayLayer'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { conversationEvidence, type SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { XpLedger } from './XpLedger'
import { XpEvidenceReport, type XpMessageScope } from './XpEvidenceReport'

type Report = { message: XpMessageScope } | { skillId: string }

/**
 * Fixed-size header control; pressing it lists saved conversation awards.
 */
export function XpChip({ chatId }: { chatId: string | null }) {
  const tr = useI18n()
  const { snapshot } = useContext(SkillEvidenceContext)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  if (!snapshot || !chatId) return null
  return <div ref={anchor} className="xp-chip-anchor">
    <button type="button" className="xp-chip" aria-label={tr('Conversation XP')} aria-haspopup="dialog" aria-expanded={ledgerOpen} onClick={() => setLedgerOpen(open => !open)}>
      <ToolbarIcon name="star" size={15} />
      <span className="xp-chip-value">{tr.number(conversationEvidence(snapshot, chatId).profile.xp)}{tr(' XP')}</span>
    </button>
    {ledgerOpen && <LedgerLayer anchor={anchor} snapshot={snapshot} chatId={chatId} onClose={() => setLedgerOpen(false)} onInspectMessage={message => setReport({ message })} />}
    {report && <XpEvidenceReport snapshot={snapshot} {...report} onClose={() => setReport(null)} />}
  </div>
}

/** The anchor includes the chip, so pressing the chip again toggles instead of reopening. */
function LedgerLayer({ anchor, snapshot, chatId, onClose, onInspectMessage }: { anchor: RefObject<HTMLDivElement | null>; snapshot: SkillSnapshot; chatId: string; onClose: () => void; onInspectMessage: (message: XpMessageScope) => void }) {
  useOverlayLayer(anchor, onClose, true)
  return <XpLedger snapshot={snapshot} chatId={chatId} onInspectMessage={onInspectMessage} />
}
