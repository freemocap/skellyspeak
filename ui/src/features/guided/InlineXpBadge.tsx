import { useI18n } from '../../components/i18n'
import { useRef, useState } from 'react'
import { playRewardSound } from '../../platform/audio/reward-sounds'
import { domainColors } from '../../domain/skills/skill-domains'
import type { MessageEvidence } from '../../domain/skills/message-evidence'

export function InlineXpBadge({ item, onOpen, generation }: { item: MessageEvidence; onOpen: () => void; generation: number }) {
  const tr = useI18n()
  const [consumed, setConsumed] = useState<number | null>(null)
  const face = useRef<HTMLSpanElement>(null)
  if (consumed === generation) return null
  return <button className="inline-xp-badge" style={{ color: domainColors(item.domainId).ink }} title={tr("{value0} XP · {value1}", { value0: String(item.xp), value1: String(item.label) })} aria-label={tr("Inspect {value0} XP · {value1}", { value0: String(item.xp), value1: String(item.label) })} onPointerDown={event => event.stopPropagation()} onClick={event => {
    event.stopPropagation()
    playRewardSound({ kind: 'pop' }, face.current!)
    setConsumed(generation)
    onOpen()
  }}><span ref={face} className="inline-xp-face">+{item.xp}</span></button>
}
