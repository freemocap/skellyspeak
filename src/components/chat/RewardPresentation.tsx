import { createPortal } from 'react-dom'
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { RewardInspectionContext } from './RewardInspectionContext'
import { RewardDetail } from './RewardBadge'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { createMessageEvidenceSelector, type MessageEvidence } from '../../lib/message-evidence'
import { rewardAnchor, visibleRewardRect } from '../../lib/reward-anchors'
import { domainColors } from '../../lib/skill-domains'
import { pulseRewardDomain } from '../../lib/reward-pulse'

type Presentation = { key: number; ids: string[]; messageId: number; source: string; phase: 'opening' | 'hovering' | 'departing'; origin: DOMRect | null }

export function RewardPresentationProvider({ children, workspace, chatId, active }: { children: ReactNode; workspace: RefObject<HTMLDivElement | null>; chatId: string | null; active: boolean }) {
  const [cards, setCards] = useState<Presentation[]>([])
  const sequence = useRef(0)
  const { snapshot } = useContext(SkillEvidenceContext)
  useEffect(() => { setCards([]) }, [chatId, active, snapshot?.target])
  const open = useCallback((evidence: MessageEvidence[], messageId: number, source: string) => {
    if (!evidence.length || !workspace.current) throw new Error('XP presentation needs evidence and a mounted workspace')
    const origin = rewardAnchor(workspace.current, 'evidence', evidence[0].id)
    const next: Presentation = { key: ++sequence.current, ids: evidence.map(item => item.id), messageId, source, phase: 'opening', origin }
    setCards(previous => [...previous.map(card => ({ ...card, phase: 'departing' as const })), next])
  }, [workspace])
  const dismiss = useCallback((key: number) => setCards(previous => previous.map(card => card.key === key ? { ...card, phase: 'departing' } : card)), [])
  const settled = useCallback((key: number) => setCards(previous => previous.map(card => card.key === key && card.phase === 'opening' ? { ...card, phase: 'hovering' } : card)), [])
  const remove = useCallback((key: number) => setCards(previous => previous.filter(card => card.key !== key)), [])
  return <RewardInspectionContext value={{ open, presenting: cards.length > 0 }}>{children}{active && cards.map(card => <FloatingReward key={card.key} card={card} workspace={workspace} chatId={chatId} dismiss={dismiss} settled={settled} remove={remove} />)}</RewardInspectionContext>
}

function FloatingReward({ card, workspace, chatId, dismiss, settled, remove }: { card: Presentation; workspace: RefObject<HTMLDivElement | null>; chatId: string | null; dismiss: (key: number) => void; settled: (key: number) => void; remove: (key: number) => void }) {
  const { snapshot } = useContext(SkillEvidenceContext)
  const selector = useRef(createMessageEvidenceSelector())
  const evidence = selector.current(snapshot, chatId, card.messageId, card.source).filter(item => card.ids.includes(item.id))
  const host = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLButtonElement>(null)
  const animation = useRef<Animation | null>(null)
  const [compactTarget, setCompactTarget] = useState(false)
  const first = evidence[0]
  const domainId = first?.domainId
  useEffect(() => { if (!first) remove(card.key) }, [first, card.key, remove])
  useLayoutEffect(() => {
    if (!first || !host.current || !workspace.current) return
    const element = host.current
    const scope = workspace.current
    const place = () => {
      const stream = scope.querySelector('.stream')
      if (!stream) throw new Error('XP presentation needs the conversation stream')
      const rect = stream.getBoundingClientRect()
      const viewport = window.visualViewport
      const top = Math.max(scope.getBoundingClientRect().top + 4, (viewport?.offsetTop ?? 0) + 8)
      const composer = scope.querySelector('.composer')?.getBoundingClientRect()
      const available = Math.min(rect.bottom, composer?.top ?? rect.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight)) - top - 8
      element.style.width = `${Math.max(1, Math.min(300, rect.width - 24))}px`
      element.style.left = `${rect.left + 12}px`
      element.style.top = `${top}px`
      element.style.maxHeight = `${Math.max(1, Math.min(260, available))}px`
      const branch = rewardAnchor(scope, 'domain', first.domainId)
      setCompactTarget(!branch)
    }
    place()
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    return () => { window.removeEventListener('resize', place); window.visualViewport?.removeEventListener('resize', place) }
  }, [first?.domainId, workspace])
  useLayoutEffect(() => {
    if (!domainId || !host.current || !workspace.current) return
    const element = host.current
    animation.current?.cancel()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (card.phase === 'hovering') return
    if (card.phase === 'opening') {
      if (reduced) { settled(card.key); return }
      const rect = element.getBoundingClientRect()
      const x = card.origin ? card.origin.left + card.origin.width / 2 - rect.left - rect.width / 2 : 0
      const y = card.origin ? card.origin.top - rect.top : 12
      animation.current = element.animate([{ transform: `translate(${x}px, ${y}px) scale(.18)`, opacity: 0 }, { transform: 'translate(0, -4px) scale(1.03)', opacity: 1, offset: .8 }, { transform: 'none', opacity: 1 }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' })
      animation.current.onfinish = () => settled(card.key)
    } else {
      if (reduced) { remove(card.key); return }
      const scope = workspace.current
      const arm = Array.from(scope.querySelectorAll('[data-reward-domain]')).find(node => node.getAttribute('data-reward-domain') === domainId && visibleRewardRect(node, scope))
      const destination = arm ?? dock.current
      const target = destination?.getBoundingClientRect()
      const rect = element.getBoundingClientRect()
      const x = target ? target.left + target.width / 2 - rect.left - rect.width / 2 : 0
      const y = target ? target.top + target.height / 2 - rect.top - rect.height / 2 : -20
      animation.current = element.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${x * .45}px, ${y - 30}px) scale(.65)`, opacity: .95, offset: .55 }, { transform: `translate(${x}px, ${y}px) scale(.03)`, opacity: 0 }], { duration: 650, easing: 'ease-in', fill: 'forwards' })
      animation.current.onfinish = () => {
        if (!destination?.isConnected) { remove(card.key); return }
        const pulses = arm ? pulseRewardDomain(scope, domainId) : [destination.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2)' }, { filter: 'brightness(1)' }], { duration: 800 })]
        const pulse = pulses[0]
        pulse.onfinish = () => remove(card.key)
      }
    }
    return () => { animation.current?.cancel() }
  }, [card.phase, card.key, domainId, workspace, settled, remove])
  if (!first) return null
  return createPortal(<>
    {compactTarget && <button ref={dock} className="reward-map-destination" style={{ color: domainColors(first.domainId).bright }} aria-label={`${first.label} skill map`} onClick={() => { workspace.current?.querySelector<HTMLButtonElement>('.conversation-map-toggle')?.click() }}>✦</button>}
    <div ref={host} className={`floating-reward ${card.phase}`}><RewardDetail evidence={evidence} onClose={() => dismiss(card.key)} interactive={card.phase !== 'departing'} /></div>
  </>, document.body)
}
