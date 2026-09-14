import { useI18n } from '../../ui/i18n'
import { claimRewardEvents } from '../../platform/ipc/rewards'
import { nativeError } from '../../platform/ipc/workspace'
import { RewardInspectionContext } from './RewardInspectionContext'
import { useContext, useEffect, useRef, useState } from 'react'
import { SkillEvidenceContext } from '../../state/useSkillEvidence'
import { skillRewards, type SkillReward } from '../../domain/skills/skill-rewards'
import { messageEvidence } from '../../domain/skills/message-evidence'
import type { SkillSnapshot } from '../../domain/skills/skills'

export function SkillRewards({ chatId, active }: { chatId: string | null; active: boolean }) {
  const tr = useI18n()
  const { snapshot, error } = useContext(SkillEvidenceContext)
  const inspection = useContext(RewardInspectionContext)
  if (!inspection) throw new Error('XP arrivals require their presentation provider')
  const arrive = inspection.arrive
  const visible = useRef({chatId,active})
  visible.current = {chatId,active}
  const [claimError,setClaimError] = useState<string|null>(null)
  const previous = useRef<{ snapshot: SkillSnapshot; chatId: string } | null>(null)
  const [queue, setQueue] = useState<SkillReward[]>([])
  useEffect(() => {
    if (!snapshot || !chatId || error) { previous.current = null; setQueue([]); return }
    const baseline = previous.current
    previous.current = { snapshot, chatId }
    if (!baseline || baseline.chatId !== chatId || baseline.snapshot.construct_registry_hash !== snapshot.construct_registry_hash || baseline.snapshot.target !== snapshot.target || baseline.snapshot.learner_id !== snapshot.learner_id || baseline.snapshot.catalog_version !== snapshot.catalog_version || baseline.snapshot.profile.choices.revision !== snapshot.profile.choices.revision) { setQueue([]); return }
    const rewards = skillRewards(baseline.snapshot, snapshot, chatId)
    if (!active) { setQueue([]); return }
    const present = (accepted: SkillReward[]) => {
      if (!visible.current.active || visible.current.chatId !== chatId) return
    for (const reward of accepted) {
      const record = snapshot.records.find(item => `${item.attempt_id}:${reward.skillId}` === reward.id)
      if (!record) throw new Error(`Missing reward record ${reward.id}`)
      const evidence = messageEvidence(snapshot, chatId, reward.messageId, record.source).filter(item => item.id === reward.id)
      arrive(evidence.map(item => ({ ...item, xp: reward.xp })), reward.messageId, record.source)
    }
    setQueue(items => [...items.filter(item => snapshot.profile.credits.some(credit => `${credit.attempt_id}:${credit.skill_id}` === item.id)), ...accepted])
    }
    if (!rewards.length) return
    if (snapshot.profile.rules_version === 2) {
      void claimRewardEvents(snapshot.target, rewards.map(r=>r.id)).then(events => {
        setClaimError(null)
        present(rewards.filter(reward=>events.some(event=>event.id===reward.id)))
      }).catch(reason=>setClaimError(nativeError(reason)))
    } else present(rewards)

  }, [snapshot, chatId, error, active, arrive])
  const reward = queue[0]
  useEffect(() => {
    if (!reward) return
    const timer = window.setTimeout(() => setQueue(items => items.slice(1)), 3000)
    return () => window.clearTimeout(timer)
  }, [reward])
  if (claimError) return <span role="alert">{tr("Reward display failed: ")}{claimError}</span>
  return <span className="skill-reward-status" role="status" aria-live="polite">{active && reward && <><span className="sr-only">{reward.xp} {tr(" XP for ")}{reward.label}: {reward.quote}</span></>}</span>
}
