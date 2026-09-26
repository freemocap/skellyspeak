import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { RewardInspectionContext } from './RewardInspectionContext'
import { XpArrivalContext, type XpArrival } from './XpArrivalContext'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { playRewardSound } from '../../../platform/audio/reward-sounds'
import type { MessageEvidence } from '../../../domain/learning/evidence/message-evidence'

export const XP_PAYOUT_STEP_MS = 120
export const XP_PAYOUT_LIFETIME_MS = 650

/** Saved awards pay out at their message counter without holding up conversation. */
export function RewardPresentationProvider({ children, chatId, active, enabled }: { children: ReactNode; chatId: string | null; active: boolean; enabled: boolean }) {
  const [arrivals, setArrivals] = useState<XpArrival[]>([])
  const [pendingClaims, setPendingClaims] = useState(0)
  const beginClaim = useCallback(() => { setPendingClaims(n => n + 1); return () => setPendingClaims(n => n - 1) }, [])
  const sequence = useRef(0)
  const timers = useRef(new Set<number>())
  const nextAt = useRef(0)
  const seen = useRef(new Set<string>())
  const { snapshot } = useContext(SkillEvidenceContext)
  useEffect(() => {
    setArrivals([])
    seen.current.clear()
    nextAt.current = 0
    return () => { timers.current.forEach(window.clearTimeout); timers.current.clear() }
  }, [chatId, active, enabled, snapshot?.target])
  const arrive = useCallback((evidence: MessageEvidence[], messageId: number, source: string) => {
    if (!enabled || !active) return
    const awards = [...new Map(evidence.map(item => [item.id, item])).values()]
    for (const award of awards) {
      if (seen.current.has(award.id)) continue
      if (!Number.isSafeInteger(award.xp) || award.xp < 1) throw new Error('Payout requires positive whole XP')
      seen.current.add(award.id)
      for (let point = 0; point < award.xp; point++) {
        const key = ++sequence.current
        const delay = Math.max(0, nextAt.current - Date.now())
        nextAt.current = Date.now() + delay + XP_PAYOUT_STEP_MS
        setArrivals(items => [...items, { key, messageId, source, paid: false }])
        const schedule = (callback: () => void, ms: number) => {
          const timer = window.setTimeout(() => { timers.current.delete(timer); callback() }, ms)
          timers.current.add(timer)
        }
        schedule(() => {
          setArrivals(items => items.map(item => item.key === key ? { ...item, paid: true } : item))
          const host = document.querySelector<HTMLElement>(`[data-reward-message="${messageId}"] [data-message-xp]`)
          if (host) playRewardSound(award.milestone && point === award.xp - 1 ? { kind: 'milestone' } : { kind: 'xp', xp: 1 }, host)
        }, delay)
        schedule(() => setArrivals(items => items.filter(item => item.key !== key)), delay + XP_PAYOUT_LIFETIME_MS)
      }
    }
  }, [enabled, active])
  const shown = active && enabled ? arrivals : []
  return <RewardInspectionContext value={{ enabled, arrive, beginClaim, presenting: enabled && (arrivals.length > 0 || pendingClaims > 0) }}>
    <XpArrivalContext value={{ arrivals: shown }}>{children}</XpArrivalContext>
  </RewardInspectionContext>
}
