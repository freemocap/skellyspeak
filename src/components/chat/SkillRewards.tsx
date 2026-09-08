import { RewardInspectionContext } from './RewardInspectionContext'
import { useContext, useEffect, useRef, useState } from 'react'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { skillRewards, type SkillReward } from '../../lib/skill-rewards'
import { messageEvidence } from '../../lib/message-evidence'
import type { SkillSnapshot } from '../../lib/skills'

export function SkillRewards({ chatId, active }: { chatId: string | null; active: boolean }) {
  const { snapshot, error } = useContext(SkillEvidenceContext)
  const inspection = useContext(RewardInspectionContext)
  if (!inspection) throw new Error('XP arrivals require their presentation provider')
  const arrive = inspection.arrive
  const previous = useRef<{ snapshot: SkillSnapshot; chatId: string } | null>(null)
  const [queue, setQueue] = useState<SkillReward[]>([])
  useEffect(() => {
    if (!snapshot || !chatId || error) { previous.current = null; setQueue([]); return }
    const baseline = previous.current
    previous.current = { snapshot, chatId }
    if (!baseline || baseline.chatId !== chatId || baseline.snapshot.target !== snapshot.target || baseline.snapshot.learner_id !== snapshot.learner_id || baseline.snapshot.catalog_version !== snapshot.catalog_version || baseline.snapshot.profile.choices.revision !== snapshot.profile.choices.revision) { setQueue([]); return }
    const rewards = skillRewards(baseline.snapshot, snapshot, chatId)
    if (!active) { setQueue([]); return }
    for (const reward of rewards) {
      const record = snapshot.records.find(item => `${item.attempt_id}:${reward.skillId}` === reward.id)
      if (!record) throw new Error(`Missing reward record ${reward.id}`)
      const evidence = messageEvidence(snapshot, chatId, reward.messageId, record.source).filter(item => item.id === reward.id)
      arrive(evidence.map(item => ({ ...item, xp: reward.xp })), reward.messageId, record.source)
    }
    setQueue(items => [...items.filter(item => snapshot.profile.credits.some(credit => `${credit.attempt_id}:${credit.skill_id}` === item.id)), ...rewards])
  }, [snapshot, chatId, error, active, arrive])
  const reward = queue[0]
  useEffect(() => {
    if (!reward) return
    const timer = window.setTimeout(() => setQueue(items => items.slice(1)), 3000)
    return () => window.clearTimeout(timer)
  }, [reward])
  return <span className="skill-reward-status" role="status" aria-live="polite">{active && reward && <><span className="sr-only">{reward.xp} XP for {reward.label}: {reward.quote}</span></>}</span>
}
