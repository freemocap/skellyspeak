import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useSeconds } from '../../components/media/InspectionTracks'
import { speechTiming, type SpeechTiming } from '../../domain/drill/timing'
import { WordPairs } from './WordPairs'
import type { AudioInspection, DrillAttemptView } from '../../generated/contracts'
import { facts, match } from './AttemptLog'

/** The full report for one take, measured against the phrase and against the
 * reference reading. The recordings themselves are drawn in the comparison
 * beside it; this card states what was measured from them.
 *
 * Everything shown is something native established. Where a measurement is
 * missing the card says so rather than leaving a gap that reads as zero. */
export function AttemptInspection({ attempt, audio, reference, rtl, onDelete, deleting }: {
  attempt: DrillAttemptView
  audio: AudioInspection | null
  reference: AudioInspection | null
  /** The phrase's script direction, which orders its word marks. */
  rtl: boolean
  onDelete: () => void
  deleting: boolean
}) {
  const tr = useI18n()
  const seconds = useSeconds()
  const comparison = attempt.comparison
  const words = comparison.words
  const exact = words.filter(word => word.kind === 'same').length
  const counted = words.filter(word => word.kind !== 'extra').length
  const yours = audio && speechTiming(audio.activity, counted)
  const theirs = reference && speechTiming(reference.activity, counted)
  const recording = attempt.audioPrunedAt !== null ? { value: tr("Removed"), note: tr("Freed by the storage limit. The transcript and comparison remain.") }
    : attempt.audioBytes === null ? { value: tr("Not kept"), note: tr("Storage is set to keep no recordings.") }
    : { value: tr("{value0} kB", { value0: tr.number(Number(attempt.audioBytes) / 1000, { maximumFractionDigits: 0 }) }), note: null }
  const pace = (timing: SpeechTiming | null) => !timing || timing.wordsPerSecond === null ? tr("—")
    : tr("{value0} words/s", { value0: tr.number(timing.wordsPerSecond, { maximumFractionDigits: 1 }) })
  const pauses = (timing: SpeechTiming | null) => !timing ? tr("—") : timing.longestPause === null ? tr("None")
    : tr("{value0} · longest {value1}", { value0: String(timing.pauses), value1: seconds(timing.longestPause) })
  const measures = [
    { label: tr("Length"), yours: audio ? seconds(audio.duration) : tr("—"), theirs: reference ? seconds(reference.duration) : tr("—") },
    { label: tr("Speaking time"), yours: yours ? seconds(yours.speaking) : tr("—"), theirs: theirs ? seconds(theirs.speaking) : tr("—") },
    { label: tr("Pace"), yours: pace(yours), theirs: pace(theirs) },
    { label: tr("Pauses inside"), yours: pauses(yours), theirs: pauses(theirs) },
  ]

  return (
    <section className="drill-inspection" aria-label={tr("Attempt {value0}", { value0: String(attempt.sequence) })}>
      <div className="drill-inspection-head">
        <h2>{tr("Attempt {value0}", { value0: String(attempt.sequence) })}</h2>
        <time className="drill-attempt-when" dateTime={attempt.createdAt} title={tr.dateTime(new Date(attempt.createdAt))}>{tr.date(new Date(attempt.createdAt), { timeStyle: 'short' })}</time>
        {facts(comparison, tr).map(fact => <span key={fact.label} className="drill-chip" data-tone={fact.tone}>{fact.label}</span>)}
        <span className="drill-inspection-words">{tr("{value0}/{value1} words exact", { value0: String(exact), value1: String(counted) })}</span>
        <span className="drill-inspection-words">{recording.value}</span>
        <span className="drill-inspection-spacer" />
        <span className="drill-inspection-score">{match(comparison, tr)}</span>
        <button type="button" className="btn drill-remove" disabled={deleting} onClick={onDelete}
          aria-label={tr("Delete take {value0}", { value0: String(attempt.sequence) })} title={tr("Delete take {value0}", { value0: String(attempt.sequence) })}>
          <ToolbarIcon name="trash" size={14} />
        </button>
      </div>
      {recording.note && <p className="drill-inspection-note">{recording.note}</p>}

      <WordPairs words={words} rtl={rtl} />
      {comparison.scriptNote === 'mismatch' && <p role="note">{tr("The transcript is in a different script from the phrase. This does not change the measurement.")}</p>}

      <table className="drill-measures" title={tr("Speaking time, pace and pauses come from detected sound, not from recognised words.")}>
        <thead><tr><td /><th scope="col">{tr("You")}</th><th scope="col">{tr("Reference")}</th></tr></thead>
        <tbody>{measures.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.yours}</td><td>{row.theirs}</td></tr>)}</tbody>
      </table>

      {/* The summary above is a reading of these numbers, never a replacement
          for them: the measurement the comparison actually produced stays here. */}
      <details className="drill-comparison">
        <summary>{tr("Comparison details")}</summary>
        <p>{tr("Characters matching the target, after {value0}", { value0: comparison.normalizations.length ? comparison.normalizations.join(', ') : tr("no normalization") })}</p>
        <dl>
          <dt>{tr("Policy")}</dt><dd>{comparison.policy}</dd>
          <dt>{tr("Character error rate")}</dt>
          <dd>{comparison.characterErrorRate === null ? tr("Not measurable")
            : tr.number(comparison.characterErrorRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
          <dt>{tr("Edits")}</dt>
          <dd>{tr("{value0} of {value1} characters", { value0: String(comparison.edits), value1: String(comparison.referenceGraphemes) })}</dd>
          <dt>{tr("Normalized before comparing")}</dt>
          <dd>{comparison.normalizations.length ? comparison.normalizations.join(', ') : tr("Nothing")}</dd>
        </dl>
      </details>
    </section>
  )
}
