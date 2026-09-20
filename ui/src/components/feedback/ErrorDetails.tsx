import { useI18n } from '../localization/i18n'
import { createContext, useContext, useState, type ReactNode } from 'react'

export const ErrorInspectionContext = createContext<((errorKey: string) => void) | null>(null)

type ErrorDetailsProps = { label: string; errorKey: string; children: ReactNode }

export function ErrorDetails(props: ErrorDetailsProps) {
  return <DismissibleError key={props.errorKey} {...props} />
}

function DismissibleError({ label, children, errorKey }: ErrorDetailsProps) {
  const inspect = useContext(ErrorInspectionContext)
  const tr = useI18n()
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return <details className="turn-errors error-details" onDoubleClick={event => event.stopPropagation()}>
    <summary><span role="alert">⚠ {label}</span><button type="button" className="error-dismiss"
      aria-label={tr("Dismiss {value0} error", { value0: String(label.toLowerCase()) })} title={tr("Dismiss error")}
      onClick={event => { event.preventDefault(); event.stopPropagation(); setDismissed(true) }}>×</button></summary>
    <div className="error-details-body">{children}{inspect && <button type="button" className="inspection-action" onClick={event => { event.stopPropagation(); inspect(errorKey) }}>{tr("Open AI activity")}</button>}</div>
  </details>
}
