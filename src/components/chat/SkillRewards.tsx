import { RewardBadge } from './RewardBadge'
import { useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { skillRewards, type SkillReward } from '../../lib/skill-rewards'
import type { SkillSnapshot } from '../../lib/skills'

function visibleRect(element: Element | undefined): DOMRect | null {
  if (!element || element.closest('[aria-hidden="true"], .mobile-hidden, .hidden')) return null
  const rect = element.getBoundingClientRect()
  return rect.width && rect.height && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth ? rect : null
}
function RewardFlight({ reward }: { reward: SkillReward }) {
  const badge = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = badge.current!
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const source = visibleRect(Array.from(document.querySelectorAll('[data-reward-evidence]')).find(item => item.getAttribute('data-reward-evidence') === reward.id)) ?? visibleRect(Array.from(document.querySelectorAll('[data-reward-message]')).find(item => item.getAttribute('data-reward-message') === String(reward.messageId)))
    const card = visibleRect(Array.from(document.querySelectorAll('[data-reward-skill]')).find(item => item.getAttribute('data-reward-skill') === reward.skillId))
    const branch = visibleRect(Array.from(document.querySelectorAll('[data-reward-domain]')).find(item => item.getAttribute('data-reward-domain') === reward.domainId))
    const total = visibleRect(document.querySelector('[data-reward-total]') ?? undefined)
    const origin = element.getBoundingClientRect()
    const points = [source, card, branch, total].filter((rect): rect is DOMRect => rect !== null)
    if (!points.length) return
    const animation = element.animate(points.map((rect, index) => ({ transform: `translate(${Math.max(8, Math.min(rect.left, window.innerWidth - origin.width - 8)) - origin.left}px, ${Math.max(8, rect.top) - origin.top}px)`, opacity: index === points.length - 1 ? 0 : 1 })), { duration: 2400, easing: 'ease-in-out', fill: 'forwards' })
    return () => animation.cancel()
  }, [reward])
  return createPortal(<div ref={badge} className="skill-reward-flight" aria-hidden="true"><RewardBadge {...reward} /></div>, document.body)
}

export function SkillRewards({ chatId }: { chatId: string | null }) {
  const { snapshot, error } = useContext(SkillEvidenceContext)
  const previous = useRef<{ snapshot: SkillSnapshot; chatId: string } | null>(null)
  const [queue, setQueue] = useState<SkillReward[]>([])
  const host = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!snapshot || !chatId || error) { previous.current = null; setQueue([]); return }
    const baseline = previous.current
    previous.current = { snapshot, chatId }
    if (!baseline || baseline.chatId !== chatId || baseline.snapshot.target !== snapshot.target || baseline.snapshot.learner_id !== snapshot.learner_id || baseline.snapshot.catalog_version !== snapshot.catalog_version || baseline.snapshot.profile.choices.revision !== snapshot.profile.choices.revision) { setQueue([]); return }
    const rewards = skillRewards(baseline.snapshot, snapshot, chatId)
    if (host.current?.closest('[aria-hidden="true"]')) { setQueue([]); return }
    setQueue(items => [...items.filter(item => snapshot.profile.credits.some(credit => `${credit.attempt_id}:${credit.skill_id}` === item.id)), ...rewards])
  }, [snapshot, chatId, error])
  const reward = queue[0]
  useEffect(() => {
    if (!reward) return
    const timer = window.setTimeout(() => setQueue(items => items.slice(1)), 2700)
    return () => window.clearTimeout(timer)
  }, [reward])
  return <span ref={host} className="skill-reward-status" role="status" aria-live="polite">{reward && <><span className="sr-only">{reward.xp} XP for {reward.label}: {reward.quote}</span><RewardFlight key={reward.id} reward={reward} /></>}</span>
}
