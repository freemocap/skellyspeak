import { ProgressCounters } from '../../../components/learning/ProgressCounters'
import { ProgressCard } from '../../../components/learning/ProgressCard'
import { useVisibleEffort } from '../../../state/learning/EffortProgressContext'
import { useConversationEffort } from '../../../state/learning/useEffortProgress'
import { useContext, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { useOverlayLayer } from '../../../components/dialogs/useOverlayLayer'
import { useHoverCard } from '../../../components/learning/useHoverCard'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { conversationEvidence, type SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { XpLedger } from './XpLedger'
import { conversationSkills } from './conversationSkills'
import { conversationUnits } from '../../../components/learning/effort-dimensions'
import { domainColors, skillDomain } from '../../../domain/learning/catalog/skill-domains'
import { XpEvidenceReport, type XpMessageScope } from './XpEvidenceReport'
import { ConversationShapeGlyph } from '../../../components/learning/SkillRadar'
import { conversationSkillPoints } from '../../../domain/learning/statistics/skill-levels'

type Report = { message: XpMessageScope } | { skillId: string }

/** The conversation's XP in the header. Hovering (mouse) or a first tap shows a
 * small card with this conversation's effort units; pressing while it shows opens
 * the full ledger of saved awards. Digits are tabular, so it widens only when the total gains a digit. */
export function XpChip({ chatId }: { chatId: string | null }) {
  const tr = useI18n()
  const shell = useVisibleEffort()
  const { snapshot } = useContext(SkillEvidenceContext)
  const effort = useConversationEffort(snapshot?.target ?? '', chatId, shell.value)
  const [ledger, setLedger] = useState(false)
  const card = useHoverCard(() => setLedger(true))
  const [report, setReport] = useState<Report | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  if (!snapshot || !chatId) return null
  const conversation = conversationEvidence(snapshot, chatId)
  const xp = conversation.profile.xp
  // This conversation's skill points, drawn as its own shape: a conversation has no level.
  const shape = conversationSkillPoints(snapshot, chatId)
  const points = shape.total
  return <div ref={anchor} className="progress-anchor" {...card.anchor}>
    <button type="button" className="xp-chip progress-trigger" aria-label={tr('Conversation XP')} aria-haspopup="dialog" aria-expanded={card.open || ledger} onClick={card.press}>
      <span className="skill-level-chip" title={tr('{value0} skill points in this conversation', { value0: points })}><ConversationShapeGlyph points={shape} /><strong>{tr('+{value0} pt', { value0: points })}</strong></span>
      <ProgressCounters xp={xp} xpLabel="Conversation XP" scope={chatId} icon="chat" effort={effort.value} effects={shell.effects} error={effort.error} />
    </button>
    {card.open && <CardLayer anchor={anchor} onClose={card.close}>
      <ProgressCard title={tr('This conversation')} icon="chat" tone="coach" xp={xp} effort={effort.value} units={conversationUnits} error={effort.error} expandLabel="Conversation XP" onExpand={() => { card.close(); setLedger(true) }}>
        <SkillList snapshot={snapshot} chatId={chatId} />
      </ProgressCard>
    </CardLayer>}
    {ledger && <DetailDialog title={tr('Conversation XP')} size="wide" className="xp-ledger-dialog" onClose={() => setLedger(false)}>
      <XpLedger snapshot={snapshot} chatId={chatId} effort={effort.value} effortError={effort.error} onInspectMessage={message => setReport({ message })} />
    </DetailDialog>}
    {report && <XpEvidenceReport snapshot={snapshot} {...report} onClose={() => setReport(null)} />}
  </div>
}

const SHOWN_SKILLS = 5

/** The conversation's credited skills, most used first; the ledger has the rest. */
function SkillList({ snapshot, chatId }: { snapshot: SkillSnapshot; chatId: string }) {
  const tr = useI18n()
  const skills = conversationSkills(snapshot, chatId)
  if (!skills.length) return <p className="progress-card-empty">{tr('No credited messages.')}</p>
  return <>
    <ol className="progress-card-skills" aria-label={tr('Skills in this conversation')}>{skills.slice(0, SHOWN_SKILLS).map(({ skill, uses, xp }) => {
      const colors = domainColors(skillDomain(snapshot, skill).id)
      return <li key={skill.id}>
        <span className="xp-domain-dot" style={{ background: colors.bright }} />
        <span className="progress-card-skill" style={{ color: colors.ink }}>{tr(skill.label)}</span>
        <span className="progress-card-skill-uses" title={tr('Credited messages')}>×{tr.number(uses)}</span>
        <strong>+{tr.number(xp)}</strong>
      </li>
    })}</ol>
    {skills.length > SHOWN_SKILLS && <p className="progress-card-empty">{tr('{value0} more skills', { value0: tr.number(skills.length - SHOWN_SKILLS) })}</p>}
  </>
}

/** The anchor includes the chip, so pressing it reaches the chip's handler instead of closing. */
function CardLayer({ anchor, onClose, children }: { anchor: RefObject<HTMLDivElement | null>; onClose: () => void; children: ReactNode }) {
  useOverlayLayer(anchor, onClose, true)
  return children
}
