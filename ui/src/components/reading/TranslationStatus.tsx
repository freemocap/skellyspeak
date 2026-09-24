import { useI18n } from '../localization/i18n'
import { operationPhase } from '../../domain/conversation/activity-summary'

/// The translation's operation state, shown where the translation will land.
/// Work in progress takes one reserved line only while the translation is set
/// to show and has no text yet; otherwise it is announced without taking space,
/// and the Translate control carries the progress. Only running work moves.
export function TranslationStatus({ state, shown }: { state?: string | null; shown: boolean }) {
  const tr = useI18n()
  const phase = operationPhase(state)
  if (phase === 'waiting' || phase === 'running') {
    return shown
      ? <div className="trans hydrating-slot" data-phase={phase} role="status">
        <span className="hydrating-label">{tr("Translating…")}</span>
        <span className="hydrating-line" aria-hidden="true" />
      </div>
      : <span className="hydrating-announce" role="status">{tr("Translating…")}</span>
  }
  return <>
    {phase === 'held' && <div className="trans" role="status">{tr("Translation held")}</div>}
    {state === 'failed' && <div className="trans" role="status">{tr("Translation failed")}</div>}
    {state === 'unknown' && <div className="trans" role="status">{tr("Translation outcome unknown")}</div>}
    {state === 'cancelled' && <div className="trans" role="status">{tr("Translation cancelled")}</div>}
    {state === 'invalidated' && <div className="trans" role="status">{tr("Translation unavailable")}</div>}
  </>
}

/// Whether translation work for this source is still in flight.
export function translationPending(state?: string | null) {
  const phase = operationPhase(state)
  return phase === 'waiting' || phase === 'running'
}
