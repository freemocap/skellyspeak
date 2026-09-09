import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { domainColors } from '../../lib/skill-domains'
import type { MessageEvidence } from '../../lib/message-evidence'
import type { SkillSnapshot } from '../../lib/skills'

export function RewardProgress({ evidence, snapshot, onClose, arrivedIds }: { arrivedIds: string[]; evidence: MessageEvidence[]; snapshot: SkillSnapshot; onClose: () => void }) {
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
  return createPortal(<aside className="reward-progress-toast" role="status" aria-label="XP saved">
    <strong>+{total} XP · {snapshot.profile.xp} XP total</strong>
    {skills.map(skill => <div key={skill.skillId} data-mobile-reward-domain={skill.domainId} style={{ color: domainColors(skill.domainId).bright }}>
      <div className="reward-progress-heading"><span>{skill.label}</span><span>{skill.xp} XP</span></div>
      <div className="reward-progress-track" role="progressbar" aria-label={`${skill.label} practice XP`} aria-valuemin={0} aria-valuemax={30} aria-valuenow={Math.min(30, skill.xp)} aria-valuetext={`${skill.xp} XP; 30 fills the practice bar`}>
        <span style={{ width: `${Math.min(30, Math.max(0, skill.xp - skill.pending)) / 30 * 100}%` }} />
      </div>
    </div>)}
    <small>Saved to your skill progress</small>
  </aside>, document.body)
}
