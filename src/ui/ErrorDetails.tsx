import { useState, type ReactNode } from 'react'

type ErrorDetailsProps = { label: string; errorKey: string; children: ReactNode }

export function ErrorDetails(props: ErrorDetailsProps) {
  return <DismissibleError key={props.errorKey} {...props} />
}

function DismissibleError({ label, children }: ErrorDetailsProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  return <details className="turn-errors error-details" onDoubleClick={event => event.stopPropagation()}>
    <summary><span role="alert">⚠ {label}</span><button type="button" className="error-dismiss"
      aria-label={`Dismiss ${label.toLowerCase()} error`} title="Dismiss error"
      onClick={event => { event.preventDefault(); event.stopPropagation(); setDismissed(true) }}>×</button></summary>
    <div className="error-details-body">{children}</div>
  </details>
}
