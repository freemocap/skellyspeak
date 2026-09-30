import { ReadingTemplateContext } from './ReadingContext'
import type { ReplyExplanation } from '../../generated/contracts'
import { Markdown } from './Markdown'
import { TargetMessage } from './TargetMessage'

/** Show alternatives as complete target sentences, keeping the template intact. */
export function SentenceCompletions({ cards }: { cards: ReplyExplanation[] }) {
  return <ReadingTemplateContext value={false}>{cards.map(card => <div className="exp" key={card.example}>
    <div className="exp-top"><span className="exp-title">{card.title}</span></div>
    <TargetMessage provenance={null} layout="compact" text={card.example} segments={[]} segmentsKey={card.example}
      translation={null} romanization={null} pronunciation={null} translateLabel={null} segmentsPending={false}
      lookupWords status={null} annotation={null} speech={null} analysis={null} focused={false} rtl={false} />
    <Markdown text={card.body} />
  </div>)}</ReadingTemplateContext>
}
