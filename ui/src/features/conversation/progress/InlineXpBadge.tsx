import { dismissReward, useRewardDismissed } from './reward-dismissal'
import { useI18n } from '../../../components/localization/i18n'
import { useRef } from 'react'
import { playRewardSound } from '../../../platform/audio/reward-sounds'
import { domainColors } from '../../../domain/learning/catalog/skill-domains'
import type { MessageEvidence } from '../../../domain/learning/evidence/message-evidence'

export function InlineXpBadge({ item, onOpen, generation }: { item: MessageEvidence; onOpen: () => void; generation: number }) {
  const tr = useI18n()
  const consumed = useRewardDismissed(item.id, generation)
  const face = useRef<HTMLSpanElement>(null)
  if (consumed) return null
  return <button className="inline-xp-badge" style={{ color: domainColors(item.domainId).ink }} title={tr("{value0} XP · {value1}", { value0: item.xp, value1: tr(item.label) })} aria-label={tr("Inspect {value0} XP · {value1}", { value0: item.xp, value1: tr(item.label) })} onPointerDown={event => event.stopPropagation()} onClick={event => {
    event.stopPropagation()
    playRewardSound({ kind: 'pop' }, face.current!)
    dismissReward(item.id, generation)
    onOpen()
  }}><span ref={face} className="inline-xp-face">+{tr.number(item.xp)}</span></button>
}
