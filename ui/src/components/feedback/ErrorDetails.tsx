import { AiRetry, AiRetryContext, type RetryAction } from './AiRetry'
import { useI18n } from '../localization/i18n'
import { Children, createContext, useContext, useState, type ReactNode } from 'react'

export const ErrorInspectionContext = createContext<((errorKey: string) => void) | null>(null)

type ErrorDetailsProps = { label: string; errorKey: string; children: ReactNode; explanation?: string; onRetry?: RetryAction | null }

export function ErrorDetails(props: ErrorDetailsProps) {
  return <DismissibleError key={props.errorKey} {...props} />
}

function DismissibleError({ label, children, errorKey, explanation, onRetry }: ErrorDetailsProps) {
  const inherited = useContext(AiRetryContext)
  const retry = onRetry === undefined ? inherited : onRetry
  const inspect = useContext(ErrorInspectionContext)
  const tr = useI18n()
  const [dismissed, setDismissed] = useState(false)
  const nodes = Children.toArray(children)
  const summary = explanation ?? nodes.filter(node => typeof node === 'string').join(' ')
  const detailNodes = nodes.filter(node => typeof node !== 'string')
  if (dismissed) return null
  return <><details className="turn-errors error-details" onDoubleClick={event => event.stopPropagation()}>
    <summary><span role="alert"><span>⚠ {label}</span>{summary && <span>{summary}</span>}</span><button type="button" className="error-dismiss"
      aria-label={tr("Dismiss {value0} error", { value0: String(label.toLowerCase()) })} title={tr("Dismiss error")}
      onClick={event => { event.preventDefault(); event.stopPropagation(); setDismissed(true) }}>×</button></summary>
    <div className="error-details-body">{detailNodes}{inspect && <button type="button" className="inspection-action" onClick={event => { event.stopPropagation(); inspect(errorKey) }}>{tr("Open AI activity")}</button>}</div>
  </details>{retry && <AiRetry run={retry} />}</>
}
