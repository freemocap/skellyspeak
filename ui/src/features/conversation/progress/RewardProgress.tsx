import { useI18n } from '../../../components/localization/i18n'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { domainColors } from '../../../domain/learning/catalog/skill-domains'
import type { MessageEvidence } from '../../../domain/learning/evidence/message-evidence'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'

export function RewardProgress({ evidence, snapshot, onClose, arrivedIds }: { arrivedIds: string[]; evidence: MessageEvidence[]; snapshot: SkillSnapshot; onClose: () => void }) {
  const tr = useI18n()
  const rewards = [...new Map(evidence.map(item => [item.id, item])).values()]
  const total = rewards.reduce((sum, item) => sum + item.xp, 0)
  const skills = [...new Set(rewards.map(item => item.skillId))].map(skillId => {
    const reward = rewards.find(item => item.skillId === skillId)!
    const progress = snapshot.profile.skills.find(item => item.skill_id === skillId)
    if (!progress) throw new Error(`Missing reward progress for ${skillId}`)
    const pending = rewards.filter(item => item.skillId === skillId && !arrivedIds.includes(item.id)).reduce((sum, item) => sum + item.xp, 0)
    return { ...reward, xp: progress.xp, pending }
  })
  useEffect(() => {
    if (rewards.some(item => !arrivedIds.includes(item.id))) return
    const close = window.setTimeout(onClose, 2400)
    return () => window.clearTimeout(close)
  }, [onClose, arrivedIds, evidence])
  return createPortal(<aside className="reward-progress-toast" role="status" aria-label={tr("XP saved")}>
    <strong>+{tr.number(total)} {tr(" XP · ")}{tr.number(snapshot.profile.xp)} {tr(" XP total")}</strong>
    {skills.map(skill => <div key={skill.skillId} data-mobile-reward-skill={skill.skillId} style={{ color: domainColors(skill.domainId).bright }}>
      <div className="reward-progress-heading"><span>{tr(skill.label)}</span><span>{tr.number(skill.xp)} {tr(" XP")}</span></div>
      <div className="reward-progress-track" role="progressbar" aria-label={tr("{value0} practice XP", { value0: tr(skill.label) })} aria-valuemin={0} aria-valuemax={50} aria-valuenow={skill.xp % 50} aria-valuetext={tr('{value0} XP; next milestone {value1}', { value0: skill.xp, value1: (Math.floor(skill.xp / 50) + 1) * 50 })}>
        <span style={{ width: `${(Math.max(0, skill.xp - skill.pending) % 50) / 50 * 100}%` }} />
      </div>
    </div>)}
    <small>{tr("Saved to your skill progress")}</small>
  </aside>, document.body)
}
