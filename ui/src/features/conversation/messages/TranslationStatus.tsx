import { useI18n } from '../../../components/localization/i18n'
import { operationPhase } from '../../../domain/conversation/activity-summary'

/// The translation's operation state, shown where the translation will land.
/// Only running work moves; waiting and held work are still.
export function TranslationStatus({ state }: { state?: string | null }) {
  const tr = useI18n()
  const phase = operationPhase(state)
  return <>
    {(phase === 'waiting' || phase === 'running') && <div className="hydrating-block" data-phase={phase} role="status">
      <span className="hydrating-label">{tr("Translating…")}</span>
      <span className="hydrating-line" aria-hidden="true" />
      <span className="hydrating-line hydrating-line-short" aria-hidden="true" />
    </div>}
    {phase === 'held' && <div className="trans" role="status">{tr("Translation held")}</div>}
    {state === 'failed' && <div className="trans" role="status">{tr("Translation failed")}</div>}
    {state === 'unknown' && <div className="trans" role="status">{tr("Translation outcome unknown")}</div>}
    {state === 'cancelled' && <div className="trans" role="status">{tr("Translation cancelled")}</div>}
    {state === 'invalidated' && <div className="trans" role="status">{tr("Translation unavailable")}</div>}
  </>
}
