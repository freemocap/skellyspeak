import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useI18n } from '../../components/localization/i18n'
import { errorMessage } from '../../platform/diagnostics/error-details'
import type { DrillAttemptView, DrillComparison } from '../../generated/contracts'

/** Every other attempt at the selected phrase, newest first, a page at a time.
 * The selected attempt is reported in full above the log, so it is not repeated
 * here; each row is a one-line summary that selects its attempt.
 *
 * A row states what was measured and nothing more. There is no graded verdict:
 * the measurement compares recognized text, not pronunciation, so a
 * Match/Close/Off scale here would be an invented one. */
export function AttemptLog({ rtl, onDelete, deleting, attempts, loading, hasMore, failure, selectedId, onSelect, onLoadMore, onRetry, liveTakes }: {
  /** The phrase's script direction, which orders each row's word marks. */
  rtl: boolean
  /** Delete one take; `deleting` holds every delete control while one runs. */
  onDelete: (attempt: DrillAttemptView) => void
  deleting: boolean
  liveTakes: { recordingId: string }[]
  attempts: DrillAttemptView[]
  loading: boolean
  hasMore: boolean
  failure: unknown
  selectedId: string | null
  onSelect: (id: string) => void
  onLoadMore: () => void
  onRetry: () => void
}) {
  const tr = useI18n()
  const linked = new Set(liveTakes.map(take => take.recordingId))
  const history = attempts.filter(attempt => attempt.id !== selectedId
    && (!attempt.transcriptionAttemptId || !linked.has(attempt.transcriptionAttemptId)))
  const failureNotice = failure != null && <ErrorNotice as="p" error={failure}>{errorMessage(failure)}
    <button type="button" className="btn" onClick={onRetry}>{tr("Try again")}</button></ErrorNotice>
  if (!attempts.length && !liveTakes.length) return <>{failureNotice}{failure == null && (loading
    ? <p role="status">{tr("Loading…")}</p>
    : <p className="center-note">{tr("No attempts yet. Record one to compare.")}</p>)}</>
  return <section className="drill-history" aria-label={tr("Earlier takes")}>{failureNotice}
    <h3 className="drill-history-head">{tr("Earlier takes")}</h3>
    <ol className="drill-attempts">
      {history.map(attempt => <li key={attempt.id}><AttemptResult attempt={attempt} rtl={rtl} onSelect={onSelect} onDelete={onDelete} deleting={deleting} /></li>)}
    </ol>
    {hasMore && <button type="button" className="btn drill-more" disabled={loading} onClick={onLoadMore}>
      {tr(loading ? "Loading…" : "Show older attempts")}
    </button>}
  </section>
}
export function AttemptResult({ attempt, rtl, onSelect, onDelete, deleting }: {
  attempt: DrillAttemptView; rtl: boolean; onSelect: (id: string) => void; onDelete: (attempt: DrillAttemptView) => void; deleting: boolean
}) {
  const tr = useI18n()
  const outcome = { same: tr("same"), substituted: tr("letters differ"), missing: tr("not heard"), extra: tr("extra") }
  return (<div className="drill-attempt-row">
    <button type="button" className="drill-attempt" onClick={() => onSelect(attempt.id)}>
      <span className="drill-attempt-head">
        <span className="drill-attempt-number">{tr("#{value0}", { value0: String(attempt.sequence) })}</span>
        {/* One mark per target word, in reading order: the word grid's colours, at a glance. */}
        <span className="drill-attempt-words" dir={rtl ? 'rtl' : 'ltr'} aria-hidden="true">
          {(attempt.comparison.reliability?.accepted === false ? [] : attempt.comparison.words).filter(word => word.kind !== 'extra').map((word, index) =>
            <span key={index} data-outcome={word.kind} title={`${word.target ?? ''}: ${outcome[word.kind]}`} />)}
        </span>
        {facts(attempt.comparison, tr).map(fact => (
          <span key={fact.label} className="drill-chip" data-tone={fact.tone}>{fact.label}</span>
        ))}
        <time className="drill-attempt-when" dateTime={attempt.createdAt} title={tr.dateTime(new Date(attempt.createdAt))}>{tr.date(new Date(attempt.createdAt), { timeStyle: 'short' })}</time>
        <span className="drill-attempt-score">{match(attempt.comparison, tr)}</span>
      </span>
      <bdi className="drill-attempt-transcript" title={`${attempt.transcript} · ${meta(attempt, tr)}`}>{attempt.transcript || tr("Nothing was transcribed.")}</bdi>
    </button>
    <button type="button" className="btn drill-remove" disabled={deleting} onClick={() => onDelete(attempt)}
      aria-label={tr("Delete take {value0}", { value0: String(attempt.sequence) })} title={tr("Delete take {value0}", { value0: String(attempt.sequence) })}>
      <ToolbarIcon name="trash" size={14} />
    </button>
  </div>)
}

/// The measured match as a percentage, or a statement that it could not be
/// measured — never a made-up number.
export function match(comparison: DrillComparison, tr: ReturnType<typeof useI18n>) {
  if (comparison.reliability?.accepted === false) return tr("Not scored")
  return comparison.matchRatio === null
    ? tr("Not measurable")
    : tr("{value0}%", { value0: String(Math.round(comparison.matchRatio * 100)) })
}

/// Only what the comparison established mechanically: an exact transcript, and
/// the advisory script note native already computed.
export function facts(comparison: DrillComparison, tr: ReturnType<typeof useI18n>) {
  const chips: { label: string; tone: string }[] = []
  const reliability = comparison.reliability
  if (reliability) {
    chips.push({ label: reliability.confidence === null ? tr("Confidence unavailable")
      : tr("Recognition confidence: {value0}", { value0: tr.number(reliability.confidence, { style: 'percent', maximumFractionDigits: 0 }) }),
      tone: reliability.confidence === null ? 'neutral' : reliability.confidence >= reliability.minimumConfidence ? 'success' : 'danger' })
    if (!reliability.accepted) chips.push({ label: reliability.reason === 'no_speech'
      ? tr("No speech detected — not scored") : reliability.reason === 'low_confidence'
        ? tr("Low confidence — not scored") : tr("Confidence unavailable — not scored"), tone: reliability.reason === 'confidence_unavailable' ? 'neutral' : 'danger' })
  }
  if (Number(comparison.edits) === 0 && comparison.matchRatio !== null) chips.push({ label: tr("Exact"), tone: 'success' })
  if (comparison.scriptNote === 'mismatch') chips.push({ label: tr("Different script"), tone: 'warning' })
  return chips
}

/// How many words matched exactly, and whether the recording is still there.
function meta(attempt: DrillAttemptView, tr: ReturnType<typeof useI18n>) {
  const words = attempt.comparison.words
  const exact = words.filter(word => word.kind === 'same').length
  const counted = words.filter(word => word.kind !== 'extra').length
  const audio = attempt.audioPrunedAt !== null ? tr("audio removed")
    : attempt.audioBytes === null ? tr("no audio kept")
    : tr("{value0} kB", { value0: tr.number(Number(attempt.audioBytes) / 1000, { maximumFractionDigits: 0 }) })
  return tr("{value0} of {value1} words exact · {value2}", {
    value0: String(exact), value1: String(counted), value2: audio,
  })
}
