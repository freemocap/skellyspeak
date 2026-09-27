import type { InspectionWordTiming } from '../../generated/contracts'
import type { WordMatch } from '../../domain/audio/word-alignment'
import { useI18n } from '../../components/localization/i18n'

/** Shared timestamp markers; seeking always uses source time. */
export function WordOverlay({ timing, duration, outcomes, mapTime, onSeek }: {
  timing: InspectionWordTiming; duration: number; outcomes?: WordMatch[]
  mapTime?: (seconds: number) => number; onSeek?: (seconds: number) => void
}) {
  const tr = useI18n()
  if (!timing.words.length) return null
  return <div className="drill-word-overlay" aria-label={tr('Timed words')}>
    {timing.words.map((word, index) => {
      const outcome = outcomes?.[index] ?? 'unknown'
      const title = `${word.word}: ${tr(outcome === 'same' ? 'Matched' : outcome === 'missing' ? 'Not matched' : 'Uncertain')} · ${tr('{value0} s', { value0: tr.number(word.start, { maximumFractionDigits: 2 }) })}`
      return <span key={word.index} className="drill-word-marker" data-outcome={outcome}
        style={{ left: `${(mapTime ? mapTime(word.start) : word.start) / duration * 100}%` }} title={title}>
        {onSeek ? <button type="button" onClick={() => onSeek(word.start)} aria-label={title}><bdi>{word.word}</bdi></button>
          : <bdi>{word.word}</bdi>}
      </span>
    })}
  </div>
}
