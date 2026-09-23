import { MixedText } from './MixedText'
import { Markdown } from './Markdown'
import { ReadingExample } from './ReadingExample'
import { TargetMessage } from './TargetMessage'
import { useI18n } from '../localization/i18n'
import type { ReplyExplanation } from '../../generated/contracts'

/** Grammar explanation cards: one quote from the target text, what is happening
 * in it, an example, and a contrast with the learner's own language. Shared by
 * the conversation analysis pane and by Drill, which asks for the same cards
 * about a practice phrase. */
export function ExplanationCards({ cards, nativeLanguageName, onTerm }: {
  cards: ReplyExplanation[]
  nativeLanguageName: string
  /** A `[[term]]` link in an explanation; omitted where there is nobody to ask. */
  onTerm?: (term: string, card: ReplyExplanation) => void
}) {
  const tr = useI18n()
  return <>{cards.map(card => (
    <div key={card.title} className="exp">
      <div className="exp-top"><span className="exp-title">{card.title}</span></div>
      {card.quote && <TargetMessage key={card.quote} layout="passage" text={card.quote} segments={[]} segmentsKey={card.quote}
        translation={null} romanization={null} pronunciation={null} translateLabel={null} segmentsPending={false}
        lookupWords status={null} annotation={null} speech={null} analysis={null} focused={false} rtl={false} />}
      <Markdown text={card.body} onTerm={onTerm ? term => onTerm(term, card) : undefined} />
      {card.example && <ReadingExample text={card.example} />}
      {card.contrast && (
        <p className="exp-vs">
          <span>{tr("vs ")}{nativeLanguageName || tr("your language")}</span>
          <MixedText text={card.contrast} />
        </p>
      )}
    </div>
  ))}</>
}
