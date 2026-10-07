import type { ReactNode } from 'react'
import { TargetMessage } from './TargetMessage'
import type { GlossSegment } from '../../generated/contracts'

/** Complete standalone text uses the same reading controls as a conversation. */
export function TargetPassage({ text, segments = [], side = 'bot', menuActions }: { menuActions?: ReactNode; text: string; segments?: GlossSegment[]; side?: 'me' | 'bot' }) {
  return <TargetMessage menuActions={menuActions} provenance={null} key={text} text={text} side={side} layout="passage" segments={segments} segmentsKey={text}
    translation={null} romanization={null} pronunciation={null} translateLabel={null}
    segmentsPending={false} lookupWords status={null} annotation={null} speech={null}
    analysis={null} focused={false} rtl={false} />
}
