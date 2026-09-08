import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { domainColors } from '../../lib/skill-domains'
import type { MessageEvidence } from '../../lib/message-evidence'
import type { SkillSnapshot } from '../../lib/skills'

export function RewardProgress({ evidence, snapshot, onClose }: { evidence: MessageEvidence[]; snapshot: SkillSnapshot; onClose: () => void }) {
  const [filled, setFilled] = useState(false)
  const rewards = [...new Map(evidence.map(item => [item.id, item])).values()]
  const total = rewards.reduce((sum, item) => sum + item.xp, 0)
  const skills = [...new Set(rewards.map(item => item.skillId))].map(skillId => {
    const reward = rewards.find(item => item.skillId === skillId)!
    const progress = snapshot.profile.skills.find(item => item.skill_id === skillId)
    if (!progress) throw new Error(`Missing reward progress for ${skillId}`)
    const added = rewards.filter(item => item.skillId === skillId).reduce((sum, item) => sum + item.xp, 0)
    return { ...reward, xp: progress.xp, added }
  })
  useEffect(() => {
    const fill = window.setTimeout(() => setFilled(true), 100)
    const close = window.setTimeout(onClose, 2800)
    return () => { window.clearTimeout(fill); window.clearTimeout(close) }
  }, [onClose])
  return createPortal(<aside className="reward-progress-toast" role="status" aria-label="XP saved">
    <strong>+{total} XP · {snapshot.profile.xp} XP total</strong>
    {skills.map(skill => <div key={skill.skillId} data-mobile-reward-domain={skill.domainId} style={{ color: domainColors(skill.domainId).bright }}>
      <div className="reward-progress-heading"><span>{skill.label}</span><span>{skill.xp} XP</span></div>
      <div className="reward-progress-track" role="progressbar" aria-label={`${skill.label} practice XP`} aria-valuemin={0} aria-valuemax={30} aria-valuenow={Math.min(30, skill.xp)} aria-valuetext={`${skill.xp} XP; 30 fills the practice bar`}>
        <span style={{ width: `${Math.min(30, filled ? skill.xp : Math.max(0, skill.xp - skill.added)) / 30 * 100}%` }} />
      </div>
    </div>)}
    <small>Saved to your skill progress</small>
  </aside>, document.body)
}
