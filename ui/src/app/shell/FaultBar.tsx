import { useI18n } from '../../components/localization/i18n'
import { useFaultStore } from '../../platform/diagnostics/faults'

/// Everything that has gone wrong anywhere in the app, shown at the very top of
/// the window until dismissed. This is the only destination for a failure.
export function FaultBar() {
  const tr = useI18n()
  const faults = useFaultStore((state) => state.faults)
  const dismiss = useFaultStore((state) => state.dismiss)
  const dismissAll = useFaultStore((state) => state.dismissAll)
  if (faults.length === 0) return null
  return (
    <div className="fault-bar" role="alert">
      <button type="button" className="btn tiny" onClick={dismissAll}>{tr("Dismiss all")}</button>
      {faults.map((f) => (
        <p key={f.id} className="fault">
          <b>{f.context}:</b> {f.message}
          <button
            type="button"
            className="fault-dismiss"
            aria-label={tr("Dismiss")}
            onClick={() => dismiss(f.id)}
          >
            ✕
          </button>
        </p>
      ))}
    </div>
  )
}
