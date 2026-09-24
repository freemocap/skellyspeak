import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { RewardInspectionContext } from './RewardInspectionContext'
import { XpArrivalContext, type XpArrival } from './XpArrivalContext'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import type { MessageEvidence } from '../../../domain/learning/evidence/message-evidence'

/** Queues saved XP awards for the header chip, which shows them one card at a time. */
export function RewardPresentationProvider({ children, chatId, active, fastMode, enabled }: { children: ReactNode; chatId: string | null; active: boolean; fastMode: boolean; enabled: boolean }) {
  const [arrivals, setArrivals] = useState<XpArrival[]>([])
  const [pendingClaims, setPendingClaims] = useState(0)
  const beginClaim = useCallback(() => { setPendingClaims(n => n + 1); return () => setPendingClaims(n => n - 1) }, [])
  const sequence = useRef(0)
  const { snapshot } = useContext(SkillEvidenceContext)
  useEffect(() => setArrivals([]), [chatId, active, enabled, snapshot?.target])
  const arrive = useCallback((evidence: MessageEvidence[], messageId: number, source: string) => {
    if (!enabled) return
    if (!evidence.length) throw new Error('XP arrival needs evidence')
    const gains = new Map(evidence.map(item => [item.id, item.xp]))
    const next: XpArrival = { key: ++sequence.current, evidence, messageId, source, xp: [...gains.values()].reduce((sum, value) => sum + value, 0), milestone: evidence.find(item => item.milestone)?.milestone }
    // A later award for the same evidence replaces the queued one.
    setArrivals(previous => [...previous.filter(item => !item.evidence.every(entry => gains.has(entry.id))), next])
  }, [enabled])
  const dismiss = useCallback((key: number) => setArrivals(previous => previous.filter(item => item.key !== key)), [])
  const shown = active && enabled ? arrivals : []
  return <RewardInspectionContext value={{ enabled, arrive, beginClaim, presenting: enabled && (arrivals.length > 0 || pendingClaims > 0) }}>
    <XpArrivalContext value={{ arrivals: shown, fastMode, dismiss }}>{children}</XpArrivalContext>
  </RewardInspectionContext>
}
