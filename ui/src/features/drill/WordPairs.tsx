import type { ReactNode } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { TargetText } from '../../components/reading/TargetText'
import type { WordComparison } from '../../generated/contracts'

/** The card's words over the attempt's, pair by pair: the reference row filled,
 * the attempt row outlined, both in the pair's outcome colour. Each aligned pair
 * wraps as a unit, including missing and extra words. The row labels share a
 * grid with the first pair, so each label sits level with its row. */
export function WordPairs({ words, rtl }: { words: WordComparison[]; rtl: boolean }) {
  const tr = useI18n()
  const pairs: ReactNode[] = words.map((word, index) => <div className="drill-word-pair" key={index} data-outcome={word.kind}>
    <span className="drill-word-reference"><span className="drill-word-outcome">{tr('Reference')}: </span>{word.target === null ? tr('—') : <TargetText text={word.target} interactive={false} />}</span>
    <span className="drill-word-attempt"><span className="drill-word-outcome">{tr('Attempt')}: </span><bdi>{word.transcript ?? tr('—')}</bdi></span>
    <span className="drill-word-outcome">{{ same: tr('Matched'), substituted: tr('Uncertain'), missing: tr('Not matched'), extra: tr('extra') }[word.kind]}</span>
  </div>)
  return <div role="group" className="drill-word-pairs" dir={rtl ? 'rtl' : 'ltr'} aria-label={tr('Words')}>
    <div className="drill-word-lead">
      <div className="drill-word-labels" aria-hidden="true">
        <span className="drill-word-reference">{tr('Reference')}</span>
        <span className="drill-word-attempt">{tr('Attempt')}</span>
      </div>
      {pairs[0]}
    </div>
    {pairs.slice(1)}
  </div>
}
