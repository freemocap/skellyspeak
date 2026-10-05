import { useState } from 'react'
import { MixedText } from './MixedText'
import { Markdown } from './Markdown'
import { ReadingExample } from './ReadingExample'
import { TargetMessage } from './TargetMessage'
import { useI18n } from '../localization/i18n'

/** Explanations longer than this start folded to their first lines. */
const FOLDED_BODY_LENGTH = 240
/** A quoted target phrase followed by its meaning in parentheses: `"¡Qué día!" (What a day!)`. */
const QUOTED_EXAMPLE = /["“«]([^"”»]+)["”»]\s*\(([^()]+)\)/gu

/** Quoted examples with their meanings, or null when the example is prose in another shape. */
export function quotedExamples(text: string): { target: string; meaning: string }[] | null {
  const pairs = [...text.matchAll(QUOTED_EXAMPLE)].map(match => ({ target: match[1].trim(), meaning: match[2].trim() }))
  return pairs.length ? pairs : null
}

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
 * has one (`translationOf`); long explanations start folded. Shared by the
 * conversation analysis pane, Reading help and Drill. */
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
  const foldable = card.body.length > FOLDED_BODY_LENGTH
  const [open, setOpen] = useState(!foldable)
  return <article className="exp">
    <header className="exp-top">
      <span className="exp-number" aria-hidden="true">{tr.number(number)}</span>
      <h4 className="exp-title">{card.title}</h4>
      {card.cefr && <span className="exp-cefr">{card.cefr}</span>}
    </header>
    {card.quote && <TargetMessage provenance={null} key={card.quote} layout="passage" text={card.quote} segments={[]} segmentsKey={card.quote}
      translation={translation} romanization={null} pronunciation={null} translateLabel={null} segmentsPending={false}
      lookupWords status={null} annotation={null} speech={null} analysis={null} focused={false} rtl={false} />}
    <div className="exp-body" data-folded={open ? undefined : 'true'}><Markdown text={card.body} onTerm={onTerm} /></div>
    {foldable && <button type="button" className="exp-fold" aria-expanded={open} onClick={() => setOpen(!open)}>{tr(open ? 'Show less' : 'Show the full explanation')}</button>}
    {card.example && <section className="exp-section">
      <h5>{tr('Example')}</h5>
      <Example text={card.example} />
    </section>}
    {card.contrast && <section className="exp-section exp-vs">
      <h5>{tr('Compared with {value0}', { value0: nativeLanguageName || tr('your language') })}</h5>
      <p><MixedText text={card.contrast} /></p>
    </section>}
  </article>
}

/** Quoted examples become one bubble per phrase with its meaning beneath; any other shape keeps the reading example. */
function Example({ text }: { text: string }) {
  const pairs = quotedExamples(text)
  if (!pairs) return <ReadingExample text={text} />
  return <ul className="exp-examples">{pairs.map(pair => <li key={pair.target}>
    <TargetMessage provenance={null} layout="passage" text={pair.target} segments={[]} segmentsKey={pair.target}
      translation={null} romanization={null} pronunciation={null} translateLabel={null} segmentsPending={false}
      lookupWords status={null} annotation={null} speech={null} analysis={null} focused={false} rtl={false} />
    <span className="exp-example-meaning" dir="auto">{pair.meaning}</span>
  </li>)}</ul>
}
