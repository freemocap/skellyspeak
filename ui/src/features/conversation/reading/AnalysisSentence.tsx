import type { GuidedToken } from '../../../types'
import type { WordGlossView } from '../../../generated/contracts'
import { anchoredTokenGlosses } from '../../../domain/reading/gloss-display'
import { TargetMessage } from '../../../components/reading/TargetMessage'

/** The same saved, interactive words as the conversation, kept in sentence order. */
export function AnalysisSentence({ text, translation, gloss, tokens = [], label, side = 'me' }: {
  text: string; translation?: string | null; gloss?: WordGlossView | null; tokens?: GuidedToken[]; label: string; side?: 'me' | 'bot'
}) {
  return <section className={`analysis-sentence analysis-sentence-${side}`} aria-label={label}>
    <h4>{label}</h4>
    <TargetMessage key={text} layout="passage" text={text} segments={gloss?.segments ?? anchoredTokenGlosses(text,tokens)} segmentsKey={text} translation={translation ?? null} romanization={null} pronunciation={null} translateLabel={null} segmentsPending={false} lookupWords status={null} annotation={null} speech={null} analysis={null} focused={false} rtl={false} />
  </section>
}
