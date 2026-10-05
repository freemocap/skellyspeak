import { AiRetry, AiRetryContext, type RetryAction } from './AiRetry'
import { AddCredits, foldedText, FriendlySummary, useFriendlyError } from './FriendlyError'
import { useI18n } from '../localization/i18n'
import { Children, createContext, useContext, useState, type ReactNode } from 'react'

export const ErrorInspectionContext = createContext<((errorKey: string) => void) | null>(null)

/** `onDismiss` lets the owner drop what failed along with its error. */
type ErrorDetailsProps = { label: string; errorKey: string; children: ReactNode; explanation?: string; onRetry?: RetryAction | null; onDismiss?: () => void }

export function ErrorDetails(props: ErrorDetailsProps) {
  return <DismissibleError key={props.errorKey} {...props} />
}

/** The summary says what happened in plain words. The recorded explanation and
 * the owner's diagnostics are the fold beneath it, never removed. */
function DismissibleError({ label, children, errorKey, explanation, onRetry, onDismiss }: ErrorDetailsProps) {
  const inherited = useContext(AiRetryContext)
  const retry = onRetry === undefined ? inherited : onRetry
  const inspect = useContext(ErrorInspectionContext)
  const tr = useI18n()
  const [dismissed, setDismissed] = useState(false)
  const nodes = Children.toArray(children)
  const recorded = explanation ?? nodes.filter(node => typeof node === 'string').join(' ')
  const detailNodes = nodes.filter(node => typeof node !== 'string')
  const friendly = useFriendlyError(recorded)
  const folded = foldedText(friendly, recorded)
  if (dismissed) return null
  return <><details className="turn-errors error-details" data-level={friendly.level} onDoubleClick={event => event.stopPropagation()}>
    <summary><span role="alert"><FriendlySummary friendly={friendly} context={label} /></span>{(folded || detailNodes.length > 0 || inspect) && <span className="error-more">{tr('Technical details')}</span>}<button type="button" className="error-dismiss"
      aria-label={tr("Dismiss {value0} error", { value0: String(label.toLowerCase()) })} title={tr("Dismiss error")}
      onClick={event => { event.preventDefault(); event.stopPropagation(); setDismissed(true); onDismiss?.() }}>×</button></summary>
    <div className="error-details-body">{folded && <p className="error-raw">{folded}</p>}{detailNodes}{inspect && <button type="button" className="inspection-action" onClick={event => { event.stopPropagation(); inspect(errorKey) }}>{tr("Open AI activity")}</button>}</div>
  </details><AddCredits friendly={friendly} />{retry && <AiRetry run={retry} />}</>
}
