import { useEffect, useRef } from 'react'
import { domainColors } from '../../lib/skill-domains'
import type { MessageEvidence } from '../../lib/message-evidence'

export function InlineXpBadge({ item, onOpen, onDismiss }: { item: MessageEvidence; onOpen: () => void; onDismiss: () => void }) {
  const host = useRef<HTMLButtonElement>(null)
  const dismiss = useRef(onDismiss)
  useEffect(() => { dismiss.current = onDismiss }, [onDismiss])
  useEffect(() => {
    const element = host.current!
    let animation: Animation | null = null
    let departing = false
    const leave = (event: Event): void => {
      const target = event.target
      if (departing || !(target instanceof Node) || element.contains(target)) return
      if (target instanceof Element) {
        if (target.closest('.reward-inspection-card')) return
        const phrase = target.closest('[data-reward-evidence]')
        if (phrase && (JSON.parse(phrase.getAttribute('data-reward-evidence')!) as string[]).includes(item.id)) return
      }
      if (event.type === 'scroll' && document.activeElement === element) return
      departing = true
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { dismiss.current(); return }
      animation = element.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 220, fill: 'forwards' })
      animation.onfinish = () => dismiss.current()
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('scroll', leave, true)
      document.addEventListener('click', leave, true)
    }, 3000)
    return () => {
      window.clearTimeout(timer)
      animation?.cancel()
      document.removeEventListener('scroll', leave, true)
      document.removeEventListener('click', leave, true)
    }
  }, [item.id])
  return <button ref={host} className="inline-xp-badge" style={{ color: domainColors(item.domainId).ink }} title={`${item.xp} XP · ${item.label}`} aria-label={`Collect ${item.xp} XP · ${item.label}`} onClick={event => {
    event.stopPropagation()
    onOpen()
    onDismiss()
  }}>+{item.xp}</button>
}
