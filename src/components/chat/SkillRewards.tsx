import { RewardInspectionContext } from './RewardInspectionContext'
import { rewardAnchor } from '../../lib/reward-anchors'
import { pulseRewardDomain } from '../../lib/reward-pulse'
import { RewardBadge } from './RewardBadge'
import { useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { skillRewards, type SkillReward } from '../../lib/skill-rewards'
import type { SkillSnapshot } from '../../lib/skills'

export function RewardFlight({ reward, workspace }: { reward: SkillReward; workspace: RefObject<HTMLDivElement | null> }) {
  const badge = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = badge.current!
    const scope = workspace.current
    if (!scope) return
    const source = rewardAnchor(scope, 'evidence', reward.id)
    // Offscreen evidence is still announced; never invent a visual origin.
    if (!source) return
    const bounds = element.getBoundingClientRect()
    const x = Math.max(8, Math.min(source.left + source.width / 2 - bounds.width / 2, window.innerWidth - bounds.width - 8))
    const y = Math.max(8, source.top - bounds.height - 6)
    element.style.left = `${x}px`
    element.style.top = `${y}px`
    element.style.opacity = '1'
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const branch = rewardAnchor(scope, 'domain', reward.domainId)
    const target = branch
    const frames: Keyframe[] = [
      { transform: 'translate(0, 6px) scale(.4)', opacity: 0, offset: 0 },
      { transform: 'translate(0, -4px) scale(1.3)', opacity: 1, offset: .12 },
      { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: .5 },
      target
        ? { transform: `translate(${target.left + target.width / 2 - x - bounds.width / 2}px, ${target.top + target.height / 2 - y - bounds.height / 2}px) scale(.1)`, opacity: 0, offset: 1 }
        : { transform: 'translate(0, -12px) scale(.8)', opacity: 0, offset: 1 },
    ]
    const animation = element.animate(frames, { duration: 2200, easing: 'ease-in-out', fill: 'forwards' })
    let pulses: Animation[] = []
    animation.onfinish = () => {
      if (!target) return
      pulses = pulseRewardDomain(scope, reward.domainId)
    }
    const cancel = () => { animation.cancel(); pulses.forEach(pulse => pulse.cancel()); element.style.opacity = '0' }
    window.addEventListener('scroll', cancel, true)
    window.addEventListener('resize', cancel)
    let observedSize: { width: number; height: number } | null = null
    const resize = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      if (observedSize && (rect.width !== observedSize.width || rect.height !== observedSize.height)) cancel()
      observedSize = { width: rect.width, height: rect.height }
    })
    resize.observe(scope)
    return () => { cancel(); resize.disconnect(); window.removeEventListener('scroll', cancel, true); window.removeEventListener('resize', cancel) }
  }, [reward, workspace])
  return createPortal(<div ref={badge} className="skill-reward-flight" aria-hidden="true"><RewardBadge {...reward} creditKind="earned" /></div>, document.body)
}

export function SkillRewards({ chatId, active, workspace }: { chatId: string | null; active: boolean; workspace: RefObject<HTMLDivElement | null> }) {
  const { snapshot, error } = useContext(SkillEvidenceContext)
  const inspection = useContext(RewardInspectionContext)
  const previous = useRef<{ snapshot: SkillSnapshot; chatId: string } | null>(null)
  const [queue, setQueue] = useState<SkillReward[]>([])
  useEffect(() => {
    if (!snapshot || !chatId || error) { previous.current = null; setQueue([]); return }
    const baseline = previous.current
    previous.current = { snapshot, chatId }
    if (!baseline || baseline.chatId !== chatId || baseline.snapshot.target !== snapshot.target || baseline.snapshot.learner_id !== snapshot.learner_id || baseline.snapshot.catalog_version !== snapshot.catalog_version || baseline.snapshot.profile.choices.revision !== snapshot.profile.choices.revision) { setQueue([]); return }
    const rewards = skillRewards(baseline.snapshot, snapshot, chatId)
    if (!active) { setQueue([]); return }
    setQueue(items => [...items.filter(item => snapshot.profile.credits.some(credit => `${credit.attempt_id}:${credit.skill_id}` === item.id)), ...rewards])
  }, [snapshot, chatId, error, active])
  const reward = queue[0]
  useEffect(() => {
    if (!reward) return
    const timer = window.setTimeout(() => setQueue(items => items.slice(1)), 3000)
    return () => window.clearTimeout(timer)
  }, [reward])
  return <span className="skill-reward-status" role="status" aria-live="polite">{active && reward && <><span className="sr-only">{reward.xp} XP for {reward.label}: {reward.quote}</span>{!inspection?.presenting && <RewardFlight key={reward.id} reward={reward} workspace={workspace} />}</>}</span>
}
