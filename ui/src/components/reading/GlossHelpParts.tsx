import type { GlossSegment } from '../../generated/contracts'
import { useReadingPreferences } from './ReadingPreferences'
import { useUiDirection } from '../localization/useUiDirection'

/** Keep each saved source part together, rather than repeating it for every field. */
export function GlossHelpParts({ text, parts, showMeaning = true, showRomanization = true, showPronunciation = true }: {
  text: string; parts: GlossSegment[]; showMeaning?: boolean; showRomanization?: boolean; showPronunciation?: boolean
}) {
  // On-demand help exposes saved aids; always-show preferences control inline text.
  const { supportsRomanization } = useReadingPreferences()
  const direction = useUiDirection()
  return <span className="gloss-help-parts" dir={direction}>{parts.map(part => {
    const availableRomanization = part.romanization
    const romanization = supportsRomanization && showRomanization && availableRomanization
    // Inline romanization still counts as available; pronunciation is only a fallback.
    const pronunciation = showPronunciation && !availableRomanization && part.pronunciation
    if (!(showMeaning && part.gloss) && !romanization && !pronunciation) return null
    return <span className="gloss-help-part" key={part.start} data-gloss-start={part.start} data-gloss-end={part.end}>
      {parts.length > 1 && <bdi className="gloss-help-source">{text.slice(part.start, part.end)}</bdi>}
      {showMeaning && part.gloss && <span className="wg" dir="auto">{part.gloss}</span>}
      {romanization && <span className="wroman"><bdi>{romanization}</bdi></span>}
      {pronunciation && <span className="wpronunciation"><bdi>{pronunciation}</bdi></span>}
    </span>
  })}</span>
}
