import { playRewardSound } from '../../lib/reward-sounds'
import { animateRewardTrails } from '../../lib/reward-trails'
import { RewardProgress } from './RewardProgress'
import { useIsMobile } from '../../hooks/useIsMobile'
import { createPortal } from 'react-dom'
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { RewardInspectionContext } from './RewardInspectionContext'
import { RewardDetail } from './RewardBadge'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { createMessageEvidenceSelector, type MessageEvidence } from '../../lib/message-evidence'
import { rewardAnchor, visibleRewardRect } from '../../lib/reward-anchors'
import { domainColors } from '../../lib/skill-domains'
import { pulseRewardDomain } from '../../lib/reward-pulse'

type Presentation = { key: number; ids: string[]; messageId: number; source: string; phase: 'waiting' | 'opening' | 'hovering' | 'departing'; origin: DOMRect | null; automatic: boolean; startAt: number; gains: Record<string, number> }

export function RewardPresentationProvider({ children, workspace, chatId, active, fastMode }: { fastMode: boolean; children: ReactNode; workspace: RefObject<HTMLDivElement | null>; chatId: string | null; active: boolean }) {
  const isMobile = useIsMobile()
  const [receipt, setReceipt] = useState<{ key: number; evidence: MessageEvidence[]; arrivedIds: string[] } | null>(null)
  const presented = useRef(new Set<string>())
  const closeReceipt = useCallback(() => setReceipt(null), [])
  const [cards, setCards] = useState<Presentation[]>([])
  const sequence = useRef(0)
  const nextArrival = useRef(0)
  const { snapshot } = useContext(SkillEvidenceContext)
  useEffect(() => { setCards([]); setReceipt(null); presented.current.clear(); nextArrival.current = 0 }, [chatId, active, snapshot?.target])
  const current = useRef({ cards, isMobile, snapshot, chatId })
  current.current = { cards, isMobile, snapshot, chatId }
  const present = useCallback((evidence: MessageEvidence[], messageId: number, source: string, automatic: boolean) => {
    if (!evidence.length || !workspace.current) throw new Error('XP presentation needs evidence and a mounted workspace')
    const origin = rewardAnchor(workspace.current, 'evidence', evidence[0].id)
    const now = performance.now()
    const startAt = automatic ? Math.max(now, nextArrival.current) : now
    if (automatic) nextArrival.current = startAt + 460 + Math.random() * 100
    const next: Presentation = { key: ++sequence.current, ids: [...new Set(evidence.map(item => item.id))], messageId, source, phase: startAt > now ? 'waiting' : 'opening', origin, automatic, startAt, gains: Object.fromEntries(evidence.map(item => [item.id, item.xp])) }
    setCards(previous => automatic ? [...previous.filter(card => card.automatic && !card.ids.every(id => next.ids.includes(id))), next] : [next])
  }, [workspace])
  const arrive = useCallback((evidence: MessageEvidence[], messageId: number, source: string) => present(evidence, messageId, source, true), [present])
  const dismiss = useCallback((key: number) => {
    const { cards, isMobile, snapshot, chatId } = current.current
    const card = cards.find(item => item.key === key)
    if (!card || card.phase === 'departing') return
    if (isMobile && snapshot) {
      const evidence = createMessageEvidenceSelector()(snapshot, chatId, card.messageId, card.source)
        .filter(item => card.ids.includes(item.id) && !presented.current.has(item.id))
        .map(item => ({ ...item, xp: Math.min(item.xp, card.gains[item.id]) }))
      if (evidence.length) {
        evidence.forEach(item => presented.current.add(item.id))
        setReceipt(previous => ({ key, evidence: [...(previous?.evidence ?? []), ...evidence], arrivedIds: previous?.arrivedIds ?? [] }))
      }
    }
    setCards(previous => previous.map(card => card.key === key ? { ...card, phase: 'departing' } : card))
  }, [])
  const landed = useCallback((ids: string[]) => setReceipt(previous => previous ? { ...previous, arrivedIds: [...new Set([...previous.arrivedIds, ...ids])] } : null), [])
  const open = useCallback((evidence: MessageEvidence[], messageId: number, source: string) => present(evidence, messageId, source, false), [present])
  const begin = useCallback((key: number) => setCards(previous => previous.map(card => card.key === key && card.phase === 'waiting' ? { ...card, phase: 'opening' } : card)), [])
  const settled = useCallback((key: number) => setCards(previous => previous.map(card => card.key === key && card.phase === 'opening' ? { ...card, phase: 'hovering' } : card)), [])
  const remove = useCallback((key: number) => setCards(previous => previous.filter(card => card.key !== key)), [])
  return <RewardInspectionContext value={{ open, arrive }}>{children}{active && receipt && snapshot && <RewardProgress key={receipt.key} arrivedIds={receipt.arrivedIds} evidence={receipt.evidence} snapshot={snapshot} onClose={closeReceipt} />}{active && cards.map((card, index) => <FloatingReward mobile={isMobile} landed={landed} depth={card.automatic ? Math.min(index, 5) : 0} fast={card.automatic && fastMode} key={card.key} card={card} workspace={workspace} chatId={chatId} dismiss={dismiss} begin={begin} settled={settled} remove={remove} />)}</RewardInspectionContext>
}

function FloatingReward({ mobile, landed, card, workspace, chatId, dismiss, settled, remove, depth, fast, begin }: { mobile: boolean; landed: (ids: string[]) => void; begin: (key: number) => void; depth: number; fast: boolean; card: Presentation; workspace: RefObject<HTMLDivElement | null>; chatId: string | null; dismiss: (key: number) => void; settled: (key: number) => void; remove: (key: number) => void }) {
  const { snapshot } = useContext(SkillEvidenceContext)
  const selector = useRef(createMessageEvidenceSelector())
  const evidence = selector.current(snapshot, chatId, card.messageId, card.source).filter(item => card.ids.includes(item.id))
  const host = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLButtonElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const sounded = useRef(false)
  useEffect(() => {
    if (!card.automatic || card.phase !== 'hovering' || sounded.current || !host.current) return
    sounded.current = true
    const xp = Object.values(card.gains).reduce((sum, value) => sum + value, 0)
    if (xp > 0) playRewardSound({ kind: 'xp', xp }, host.current)
  }, [card.automatic, card.phase, card.gains])
  const animation = useRef<Animation | null>(null)
  const trailCleanups = useRef(new Set<() => void>())
  useEffect(() => {
    const cleanups = trailCleanups.current
    return () => { for (const stop of cleanups) stop() }
  }, [])
  const [compactTarget, setCompactTarget] = useState(false)
  const first = evidence[0]
  const domainId = first?.domainId
  useEffect(() => {
    if (card.phase !== 'waiting') return
    const timer = window.setTimeout(() => begin(card.key), Math.max(0, card.startAt - performance.now()))
    return () => window.clearTimeout(timer)
  }, [card.phase, card.key, card.startAt, begin])
  useEffect(() => {
    if (card.phase !== 'hovering' || (card.automatic ? !fast : hovered || focused)) return
    const timer = window.setTimeout(() => dismiss(card.key), card.automatic ? 500 : 4000)
    return () => window.clearTimeout(timer)
  }, [fast, card.automatic, card.phase, card.key, dismiss, hovered, focused])
  useEffect(() => { if (!first) remove(card.key) }, [first, card.key, remove])
  useLayoutEffect(() => {
    if (!first || !host.current || !workspace.current) return
    const element = host.current
    const scope = workspace.current
    const place = () => {
      const surface = scope.querySelector(scope.classList.contains('mobile-lesson') ? '.break' : '.stream')
      if (!surface) throw new Error('XP presentation needs the active practice surface')
      const rect = surface.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportHeight = viewport?.height ?? window.innerHeight
      const viewportWidth = viewport?.width ?? window.innerWidth
      // Cards are overlays. The visible viewport bounds their size even when
      // the keyboard or composer leaves almost no room in the message stream.
      const height = Math.max(1, Math.min(260, viewportHeight - 16 - depth * 9))
      const width = Math.max(1, Math.min(300, rect.width - 24, viewportWidth - 16 - depth * 3))
      const top = Math.min(Math.max(mobile && card.origin ? card.origin.top - 12 : scope.getBoundingClientRect().top + 4, viewportTop + 8), viewportTop + viewportHeight - height - 8 - depth * 9)
      const left = Math.max(viewportLeft + 8, Math.min(rect.left + 12 + depth * 3, viewportLeft + viewportWidth - width - 8))
      element.style.width = `${width}px`
      element.style.left = `${left}px`
      element.style.top = `${top + depth * 9}px`
      element.style.zIndex = String(card.automatic ? 1105 - depth : 1106)
      element.style.maxHeight = `${height}px`
      const branch = rewardAnchor(scope, 'domain', first.domainId)
      setCompactTarget(!branch)
    }
    place()
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    return () => { window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place) }
  }, [first?.domainId, workspace, depth, card.phase, card.automatic, mobile, card.origin])
  useLayoutEffect(() => {
    if (!domainId || !host.current || !workspace.current) return
    const element = host.current
    animation.current?.cancel()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (card.phase === 'hovering') return
    if (card.phase === 'opening') {
      if (mobile && fast) { dismiss(card.key); return }
      if (reduced) { settled(card.key); return }
      const rect = element.getBoundingClientRect()
      const x = card.origin ? card.origin.left + card.origin.width / 2 - rect.left - rect.width / 2 : 0
      const y = card.origin ? card.origin.top - rect.top : 12
      const frames: Keyframe[] = [{ transform: `translate(${x}px, ${y}px) scale(.18)`, opacity: 0 }, { transform: 'translate(0, -4px) scale(1.03)', opacity: 1, offset: .8 }, { transform: 'none', opacity: 1 }]
      const timing = { duration: 440, easing: 'cubic-bezier(.2,.8,.2,1)' }
      animateRewardTrails(element, frames, timing, trailCleanups.current)
      animation.current = element.animate(frames, timing)
      animation.current.onfinish = () => settled(card.key)
    } else {
      if (reduced) { landed(card.ids); remove(card.key); return }
      const scope = workspace.current
      const arm = Array.from(scope.querySelectorAll('[data-reward-domain]')).find(node => node.getAttribute('data-reward-domain') === domainId && visibleRewardRect(node, scope))
      const receiptTarget = document.querySelector(`[data-mobile-reward-domain="${domainId}"]`)
      const destination = receiptTarget ?? arm ?? (mobile ? document.querySelector('.profile-trigger') : dock.current)
      const target = destination?.getBoundingClientRect()
      const rect = element.getBoundingClientRect()
      const x = target ? target.left + target.width / 2 - rect.left - rect.width / 2 : 0
      const y = target ? target.top + target.height / 2 - rect.top - rect.height / 2 : -20
      const bendY = mobile ? Math.max(-rect.top + 8, y * .45 - 20) : y - 30
      const frames: Keyframe[] = [{ transform: 'none', opacity: 1 }, { transform: `translate(${x * .45}px, ${bendY}px) scale(.65)`, opacity: .95, offset: .55 }, { transform: `translate(${x}px, ${y}px) scale(.03)`, opacity: 0 }]
      const timing: KeyframeAnimationOptions = { duration: mobile ? 340 : 560, easing: mobile ? 'cubic-bezier(.2,.7,.3,1)' : 'cubic-bezier(.42,0,.75,.35)', fill: 'forwards' }
      animateRewardTrails(element, frames, timing, trailCleanups.current)
      animation.current = element.animate(frames, timing)
      animation.current.onfinish = () => {
        landed(card.ids)
        if (mobile && fast && destination instanceof HTMLElement) playRewardSound({ kind: 'xp', xp: Object.values(card.gains).reduce((sum, value) => sum + value, 0) }, destination)
        if (!destination?.isConnected) { remove(card.key); return }
        const pulses = arm && !receiptTarget ? pulseRewardDomain(scope, domainId) : [destination.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.65) drop-shadow(0 0 7px currentColor)' }, { filter: 'brightness(1)' }], { duration: 800 })]
        const pulse = pulses[0]
        pulse.onfinish = () => remove(card.key)
      }
    }
    return () => { animation.current?.cancel() }
  }, [card.phase, card.key, domainId, workspace, settled, remove, mobile, fast, dismiss, landed])
  if (!first || card.phase === 'waiting') return null
  return createPortal(<>
    {compactTarget && !mobile && <button ref={dock} className="reward-map-destination" style={{ color: domainColors(first.domainId).bright }} aria-label={`${first.label} skill map`} onClick={() => { workspace.current?.querySelector<HTMLButtonElement>('.conversation-map-toggle')?.click() }}>✦</button>}
    <div ref={host} className={`floating-reward ${card.phase}`} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}><RewardDetail automatic={card.automatic} evidence={evidence} onClose={() => dismiss(card.key)} interactive={card.phase !== 'departing'} /></div>
  </>, document.body)
}
