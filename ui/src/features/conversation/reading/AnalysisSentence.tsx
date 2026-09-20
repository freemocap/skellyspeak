import type { GuidedToken } from '../../../types'
import type { WordGlossView } from '../../../generated/contracts'
import { anchoredTokenGlosses } from '../../../domain/reading/gloss-display'
import { ReadingPassage } from './ReadingPassage'

/** The same saved, interactive words as the conversation, kept in sentence order. */
export function AnalysisSentence({ text, translation, gloss, tokens = [], label, side = 'me' }: {
  text: string; translation?: string | null; gloss?: WordGlossView | null; tokens?: GuidedToken[]; label: string; side?: 'me' | 'bot'
}) {
  return <section className={`analysis-sentence analysis-sentence-${side}`} aria-label={label}>
    <h4>{label}</h4>
    <ReadingPassage key={text} text={text} translation={translation} segments={gloss?.segments ?? anchoredTokenGlosses(text,tokens)} />
  </section>
}
