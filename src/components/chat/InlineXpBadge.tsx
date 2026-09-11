import { useRef, useState } from 'react'
import { playRewardSound } from '../../lib/reward-sounds'
import { domainColors } from '../../lib/skill-domains'
import type { MessageEvidence } from '../../lib/message-evidence'

export function InlineXpBadge({ item, onOpen, generation }: { item: MessageEvidence; onOpen: () => void; generation: number }) {
  const [consumed, setConsumed] = useState<number | null>(null)
  const face = useRef<HTMLSpanElement>(null)
  if (consumed === generation) return null
  return <button className="inline-xp-badge" style={{ color: domainColors(item.domainId).ink }} title={`${item.xp} XP · ${item.label}`} aria-label={`Inspect ${item.xp} XP · ${item.label}`} onPointerDown={event => event.stopPropagation()} onClick={event => {
    event.stopPropagation()
    playRewardSound({ kind: 'pop' }, face.current!)
    setConsumed(generation)
    onOpen()
  }}><span ref={face} className="inline-xp-face">+{item.xp}</span></button>
}
