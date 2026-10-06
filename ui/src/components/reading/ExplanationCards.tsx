import { useState } from 'react'
import { MixedText } from './MixedText'
import { Markdown } from './Markdown'
import { ReadingExample } from './ReadingExample'
import { TargetMessage } from './TargetMessage'
import { useI18n } from '../localization/i18n'

/** Explanations longer than this start folded to their first lines. */
const FOLDED_BODY_LENGTH = 240

/** One grammar explanation: a quote from the target text, what is happening in
 * it, an example, and a contrast with the learner's own language. */
export interface ExplanationCard {
  title: string
  quote?: string
  cefr?: string | null
  body: string
  example?: string | null
  contrast?: string | null
}

/** Grammar explanation cards, numbered in reading order. Each quote is the same
 * interactive bubble as the conversation, with its translation when the owner
 * has one (`translationOf`). The first card starts open unless its explanation
 * is long; later cards start folded to their title, quote and first lines.
 * Every field is shown as returned: titles keep their casing and examples stay
 * one intact string. Shared by the conversation analysis pane, Reading help and Drill. */
export function ExplanationCards({ cards, nativeLanguageName, onTerm, translationOf }: {
  cards: ExplanationCard[]
  nativeLanguageName: string
  /** A `[[term]]` link in an explanation; omitted where there is nobody to ask. */
  onTerm?: (term: string, card: ExplanationCard) => void
  translationOf?: (quote: string) => string | null
}) {
  return <ol className="exp-list">{cards.map((card, index) =>
    <li key={card.title}><Explanation card={card} number={index + 1} nativeLanguageName={nativeLanguageName}
      onTerm={onTerm ? term => onTerm(term, card) : undefined} translation={card.quote && translationOf ? translationOf(card.quote) : null} /></li>)}</ol>
}

function Explanation({ card, number, nativeLanguageName, onTerm, translation }: {
  card: ExplanationCard; number: number; nativeLanguageName: string; onTerm?: (term: string) => void; translation: string | null
}) {
  const tr = useI18n()
  const long = card.body.length > FOLDED_BODY_LENGTH
  const foldable = long || (number > 1 && Boolean(card.example || card.contrast))
  const [open, setOpen] = useState(!foldable || (number === 1 && !long))
  return <article className="exp">
    <header className="exp-top">
      <span className="exp-number" aria-hidden="true">{tr.number(number)}</span>
      <h4 className="exp-title">{card.title}</h4>
      {card.cefr && <span className="exp-cefr">{card.cefr}</span>}
    </header>
    {card.quote && <TargetMessage provenance={null} key={card.quote} layout="passage" text={card.quote} segments={[]} segmentsKey={card.quote}
      translation={translation} romanization={null} pronunciation={null} translateLabel={null} segmentsPending={false}
      lookupWords status={null} annotation={null} speech={null} analysis={null} focused={false} rtl={false} />}
    <div className="exp-body" data-folded={open || !long ? undefined : 'true'}><Markdown text={card.body} onTerm={onTerm} /></div>
    {foldable && <button type="button" className="exp-fold" aria-expanded={open} onClick={() => setOpen(!open)}>{tr(open ? 'Show less' : 'Show the full explanation')}</button>}
    {open && card.example && <section className="exp-section">
      <h5>{tr('Example')}</h5>
      <ReadingExample text={card.example} />
    </section>}
    {open && card.contrast && <section className="exp-section exp-vs">
      <h5>{tr('Compared with {value0}', { value0: nativeLanguageName || tr('your language') })}</h5>
      <p><MixedText text={card.contrast} /></p>
    </section>}
  </article>
}
