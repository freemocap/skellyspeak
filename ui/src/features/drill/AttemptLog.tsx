import { useI18n } from '../../components/localization/i18n'
import { errorMessage } from '../../platform/diagnostics/error-details'
import type { DrillAttemptView, DrillComparison } from '../../generated/contracts'

/** Every attempt at the selected phrase, newest first, a page at a time.
 *
 * A card states what was measured and nothing more. There is no graded verdict:
 * the measurement compares recognized text, not pronunciation, so a
 * Match/Close/Off scale here would be an invented one. */
export function AttemptLog({ attempts, loading, hasMore, failure, selectedId, onSelect, onLoadMore, onRetry }: {
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
  if (failure != null) return <p role="alert">{errorMessage(failure)}
    <button type="button" className="btn" onClick={onRetry}>{tr("Try again")}</button></p>
  if (!attempts.length) {
    return loading
      ? <p role="status">{tr("Loading…")}</p>
      : <p className="center-note">{tr("No attempts yet. Record one to compare.")}</p>
  }
  return (<>
    <ol className="drill-attempts">
      {attempts.map(attempt => (
        <li key={attempt.id}>
          <button type="button" className="drill-attempt" aria-current={attempt.id === selectedId}
            onClick={() => onSelect(attempt.id)}>
            <span className="drill-attempt-head">
              <span className="drill-attempt-number">{tr("#{value0}", { value0: String(attempt.sequence) })}</span>
              {facts(attempt.comparison, tr).map(fact => (
                <span key={fact.label} className="drill-chip" data-tone={fact.tone}>{fact.label}</span>
              ))}
              <span className="drill-attempt-when">{tr.dateTime(new Date(attempt.createdAt))}</span>
              <span className="drill-attempt-score">{match(attempt.comparison, tr)}</span>
            </span>
            <bdi className="drill-attempt-transcript">{attempt.transcript || tr("Nothing was transcribed.")}</bdi>
            <span className="drill-attempt-meta">{meta(attempt, tr)}</span>
          </button>
        </li>
      ))}
    </ol>
    {hasMore && <button type="button" className="btn drill-more" disabled={loading} onClick={onLoadMore}>
      {tr(loading ? "Loading…" : "Show older attempts")}
    </button>}
  </>)
}

/// The measured match as a percentage, or a statement that it could not be
/// measured — never a made-up number.
export function match(comparison: DrillComparison, tr: ReturnType<typeof useI18n>) {
  return comparison.matchRatio === null
    ? tr("Not measurable")
    : tr("{value0}%", { value0: String(Math.round(comparison.matchRatio * 100)) })
}

/// Only what the comparison established mechanically: an exact transcript, and
/// the advisory script note native already computed.
export function facts(comparison: DrillComparison, tr: ReturnType<typeof useI18n>) {
  const chips: { label: string; tone: string }[] = []
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
