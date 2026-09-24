import { useContext, useEffect, useRef, useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { TargetText } from '../../../components/reading/TargetText'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { domainColors } from '../../../domain/learning/catalog/skill-domains'
import { playRewardSound } from '../../../platform/audio/reward-sounds'
import { XpMeter } from './XpMeter'
import type { XpArrival } from './XpArrivalContext'

/** Fast mode closes the card after two seconds; hovering or focusing it restarts the wait. */
export const XP_CARD_HOLD_MS = 2000

export function XpArrivalCard({ arrival, remaining, fastMode, onDismiss, onInspectMessage, onInspectSkill }: {
  arrival: XpArrival; remaining: number; fastMode: boolean; onDismiss: () => void; onInspectMessage: () => void; onInspectSkill: (skillId: string) => void
}) {
  const tr = useI18n()
  const { snapshot } = useContext(SkillEvidenceContext)
  const host = useRef<HTMLElement>(null)
  const [held, setHeld] = useState(false)
  const [kept, setKept] = useState(false)
  const timed = fastMode && !kept
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss
  useEffect(() => {
    if (!host.current) throw new Error('XP card sound needs its mounted card')
    if (arrival.xp > 0) playRewardSound(arrival.milestone ? { kind: 'milestone' } : { kind: 'xp', xp: arrival.xp }, host.current)
  }, [arrival])
  useEffect(() => {
    if (!timed || held) return
    const timer = window.setTimeout(() => dismiss.current(), XP_CARD_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [timed, held])
  if (!snapshot) throw new Error('XP card needs saved skill evidence')
  const skills = [...new Map(arrival.evidence.map(item => [item.id, item])).values()]
  return <section ref={host} className={`xp-arrival-card${arrival.milestone ? ' is-milestone' : ''}`} role="status" aria-label={tr('XP saved')}
    onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)}
    onFocus={() => setHeld(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false) }}>
    {arrival.milestone && <p className="xp-arrival-milestone"><ToolbarIcon name="star" size={15} />{tr('{value0} XP milestone', { value0: arrival.milestone })}</p>}
    {skills.map(item => {
      const colors = domainColors(item.domainId)
      return <div className="xp-arrival-skill" key={item.id}>
        <div className="xp-arrival-heading">
          <span className="xp-domain-dot" style={{ background: colors.bright }} />
          <button type="button" className="xp-skill-link" style={{ color: colors.ink }} aria-haspopup="dialog" onClick={() => onInspectSkill(item.skillId)}>{tr(item.label)}</button>
          <strong>+{tr.number(item.xp)}{tr(' XP')}</strong>
        </div>
        <blockquote dir="auto"><TargetText text={item.quote} /></blockquote>
        <XpMeter snapshot={snapshot} skillId={item.skillId} label={item.label} gain={item.xp} color={colors.bright} />
      </div>
    })}
    <div className="xp-arrival-actions">
      {remaining > 0 && <span className="xp-arrival-remaining">{tr('{value0} more', { value0: remaining })}</span>}
      {timed && <button type="button" className="btn" onClick={() => setKept(true)}>{tr('Keep')}</button>}
      <button type="button" className="btn" aria-haspopup="dialog" onClick={onInspectMessage}>{tr('Message XP')}</button>
    </div>
    <button type="button" className="xp-arrival-close" aria-label={tr('Close XP details')} onClick={onDismiss}><ToolbarIcon name="close" size={15} /></button>
    {timed && !held && <span className="xp-arrival-timer" aria-hidden="true" />}
  </section>
}
