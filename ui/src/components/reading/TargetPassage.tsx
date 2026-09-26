import { TargetMessage } from './TargetMessage'

/** Complete standalone text uses the same reading controls as a conversation. */
export function TargetPassage({ text }: { text: string }) {
  return <TargetMessage key={text} text={text} layout="passage" segments={[]} segmentsKey={text}
    translation={null} romanization={null} pronunciation={null} translateLabel={null}
    segmentsPending={false} lookupWords status={null} annotation={null} speech={null}
    analysis={null} focused={false} rtl={false} />
}
