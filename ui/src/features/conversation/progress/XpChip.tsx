import { ProgressCounters } from '../../../components/learning/ProgressCounters'
import { ProgressCard } from '../../../components/learning/ProgressCard'
import { useVisibleEffort } from '../../../state/learning/EffortProgressContext'
import { useConversationEffort } from '../../../state/learning/useEffortProgress'
import { useContext, useRef, type ReactNode, type RefObject } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { useOverlayLayer } from '../../../components/dialogs/useOverlayLayer'
import { useHoverCard } from '../../../components/learning/useHoverCard'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { conversationEvidence, type SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { conversationSkills } from './conversationSkills'
import { conversationUnits } from '../../../components/learning/effort-dimensions'
import { domainColors, skillDomain } from '../../../domain/learning/catalog/skill-domains'
import { ConversationShapeGlyph } from '../../../components/learning/SkillRadar'
import { conversationSkillPoints } from '../../../domain/learning/statistics/skill-levels'

/** Which part of the learning panel's Progress tab a header counter opens. */
export type ConversationProgressSection = 'skills' | 'xp'

/** This conversation's two counters in the header: its skill points, drawn as
 * its own shape (a conversation has no level), and its XP. The points open the
 * learning panel's Progress tab at Skills. Hovering the XP (or a first tap)
 * shows a card with this conversation's effort and credited skills; pressing
 * it opens the Progress tab at XP. Digits are tabular, so a counter widens
 * only when its total gains a digit. */
export function XpChip({ chatId, onOpen }: { chatId: string | null; onOpen: (section: ConversationProgressSection) => void }) {
  const tr = useI18n()
  const shell = useVisibleEffort()
  const { snapshot } = useContext(SkillEvidenceContext)
  const effort = useConversationEffort(snapshot?.target ?? '', chatId, shell.value)
  const card = useHoverCard(() => onOpen('xp'))
  const anchor = useRef<HTMLDivElement>(null)
  if (!snapshot || !chatId) return null
  const xp = conversationEvidence(snapshot, chatId).profile.xp
  const shape = conversationSkillPoints(snapshot, chatId)
  return <div ref={anchor} className="progress-anchor xp-chip-group">
    <button type="button" className="skill-level-chip" aria-label={tr('{value0} skill points in this conversation', { value0: shape.total })} title={tr('{value0} skill points in this conversation', { value0: shape.total })} onClick={() => onOpen('skills')}>
      <ConversationShapeGlyph points={shape} /><strong>{tr('+{value0} pt', { value0: shape.total })}</strong>
    </button>
    <button type="button" className="xp-chip progress-trigger" aria-label={tr('Conversation XP')} aria-haspopup="dialog" aria-expanded={card.open} onClick={card.press} {...card.anchor}>
      <ProgressCounters xp={xp} xpLabel="Conversation XP" scope={chatId} icon="chat" effort={effort.value} effects={shell.effects} error={effort.error} />
    </button>
    {card.open && <CardLayer anchor={anchor} onClose={card.close}>
      <div {...card.anchor}><ProgressCard title={tr('This conversation')} icon="chat" tone="coach" xp={xp} effort={effort.value} units={conversationUnits} error={effort.error} expandLabel="Conversation XP" onExpand={() => { card.close(); onOpen('xp') }}>
        <SkillList snapshot={snapshot} chatId={chatId} />
      </ProgressCard></div>
    </CardLayer>}
  </div>
}

const SHOWN_SKILLS = 5

/** The conversation's credited skills, most used first; the Progress tab has the rest. */
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
    {skills.length > SHOWN_SKILLS && <p className="progress-card-empty">{tr('{count} more skills', { count: skills.length - SHOWN_SKILLS })}</p>}
  </>
}

/** The anchor includes the chip, so pressing it reaches the chip's handler instead of closing. */
function CardLayer({ anchor, onClose, children }: { anchor: RefObject<HTMLDivElement | null>; onClose: () => void; children: ReactNode }) {
  useOverlayLayer(anchor, onClose, true)
  return children
}
