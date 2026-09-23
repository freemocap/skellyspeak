import { useI18n } from '../../components/localization/i18n'

/** How far back a clear reaches. `null` minutes means every take. */
const WINDOWS: readonly (number | null)[] = [5, 60, null]

/** Clear the recent past of one phrase: its takes from the last few minutes,
 * the last hour, or all of them. Deleting is permanent, so the choices sit
 * behind one more click and each says exactly what it removes. */
export function ClearTakes({ disabled, onClear }: { disabled: boolean; onClear: (since: Date | null) => void }) {
  const tr = useI18n()
  return <details className="drill-clear">
    <summary>{tr("Clear takes…")}</summary>
    <div className="drill-clear-panel" role="group" aria-label={tr("Clear takes…")}>
      <p>{tr("Deletes the takes and their recordings for this phrase. This cannot be undone.")}</p>
      <div className="drill-clear-actions">
        {WINDOWS.map(minutes => <button key={minutes ?? 'all'} type="button" className="btn danger" disabled={disabled}
          onClick={event => {
            event.currentTarget.closest('details')?.removeAttribute('open')
            onClear(minutes === null ? null : new Date(Date.now() - minutes * 60_000))
          }}>
          {minutes === null ? tr("All takes") : minutes === 60 ? tr("Last hour") : tr("Last {value0} minutes", { value0: String(minutes) })}
        </button>)}
      </div>
    </div>
  </details>
}
