import type { GuidedToken } from '../../types'
import type { WordGlossView } from '../../generated/contracts'
import { AnnotatedText } from '../../components/TargetText'
import { SavedGlossText } from './SavedGlossText'

/** The same saved, interactive words as the conversation, kept in sentence order. */
export function AnalysisSentence({ text, translation, gloss, tokens = [], label, side = 'me' }: {
  text: string; translation?: string | null; gloss?: WordGlossView | null; tokens?: GuidedToken[]; label: string; side?: 'me' | 'bot'
}) {
  return <section className={`analysis-sentence analysis-sentence-${side}`} aria-label={label}>
    <h4>{label}</h4>
    <p className="sentence" dir="auto">{gloss
      ? <SavedGlossText key={gloss.attemptId} text={text} segments={gloss.segments} />
      : <AnnotatedText text={text} tokens={tokens} />}</p>
    {translation && <p className="trans-d" dir="auto">{translation}</p>}
  </section>
}
