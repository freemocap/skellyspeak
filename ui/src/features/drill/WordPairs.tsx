import { useI18n } from '../../components/localization/i18n'
import { TargetText } from '../../components/reading/TargetText'
import type { WordComparison } from '../../generated/contracts'

/** Each aligned pair wraps as a unit, including missing and extra words. */
export function WordPairs({ words, rtl }: { words: WordComparison[]; rtl: boolean }) {
  const tr = useI18n()
  return <div role="group" className="drill-word-pairs" dir={rtl ? 'rtl' : 'ltr'} aria-label={tr('Word by word')}>
    <div className="drill-word-labels" aria-hidden="true"><span>{tr('Target')}</span><span>{tr('Heard')}</span></div>
    {words.map((word, index) => <div className="drill-word-pair" key={index} data-outcome={word.kind}>
      <span><span className="drill-word-outcome">{tr('Target')}: </span>{word.target === null ? tr('—') : <TargetText text={word.target} interactive={false} />}</span>
      <span><span className="drill-word-outcome">{tr('Heard')}: </span><bdi>{word.transcript ?? tr('—')}</bdi></span>
      <span className="drill-word-outcome">{{ same: tr('same'), substituted: tr('letters differ'), missing: tr('not heard'), extra: tr('extra') }[word.kind]}</span>
    </div>)}
  </div>
}
