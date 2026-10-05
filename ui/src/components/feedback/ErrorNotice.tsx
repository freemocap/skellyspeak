import { AiRetry, AiRetryContext, type RetryAction } from './AiRetry'
import { AddCredits, FriendlySummary, useFriendlyError } from './FriendlyError'
import { Children, useContext, useState, type ReactNode } from 'react'
import { useI18n } from '../localization/i18n'

/** Dismiss only the presentation; a new failure becomes visible independently.
 *
 * A failure the app recognises leads with its plain-words summary and folds the
 * owner's text beneath it; the owner's controls stay in view. Anything else,
 * and an inline `span` notice that cannot hold a fold, shows the owner's
 * children as written. */
export function ErrorNotice({ error, children, as: Tag = 'div', className = '', dismissible = true, onRetry }: {
  onRetry?: RetryAction | null
  error: unknown
  dismissible?: boolean
  children: ReactNode
  as?: 'div' | 'p' | 'span'
  className?: string
}) {
  const tr = useI18n()
  const inherited = useContext(AiRetryContext)
  const retry = onRetry === undefined ? inherited : onRetry
  const friendly = useFriendlyError(error)
  const [dismissed, setDismissed] = useState<{ error: unknown } | null>(null)
  if (dismissed && Object.is(dismissed.error, error)) return null
  const dismiss = dismissible && <button type="button" className="error-dismiss" aria-label={tr('Dismiss error')} title={tr('Dismiss error')}
    onClick={event => { event.preventDefault(); event.stopPropagation(); setDismissed({ error }) }}>×</button>
  if (friendly.kind === 'unknown' || Tag === 'span') return <Tag role="alert" className={`error-notice ${className}`}>
    {dismiss}
    {children}
    {retry && <AiRetry run={retry} />}
  </Tag>
  const nodes = Children.toArray(children)
  const recorded = nodes.filter(node => typeof node === 'string').join('').trim()
  return <div role="alert" className={`error-notice ${className}`} data-level={friendly.level}>
    {dismiss}
    <FriendlySummary friendly={friendly} context={null} />
    {recorded && <details className="response-details"><summary>{tr('Technical details')}</summary><p className="error-raw">{recorded}</p></details>}
    {nodes.filter(node => typeof node !== 'string')}
    <AddCredits friendly={friendly} />
    {retry && <AiRetry run={retry} />}
  </div>
}
