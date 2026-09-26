import { AiRetry, AiRetryContext, type RetryAction } from './AiRetry'
import { useContext, useState, type ReactNode } from 'react'
import { useI18n } from '../localization/i18n'

/** Dismiss only the presentation; a new failure becomes visible independently. */
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
  const [dismissed, setDismissed] = useState<{ error: unknown } | null>(null)
  if (dismissed && Object.is(dismissed.error, error)) return null
  return <Tag role="alert" className={`error-notice ${className}`}>
    {dismissible && <button type="button" className="error-dismiss" aria-label={tr('Dismiss error')} title={tr('Dismiss error')}
      onClick={event => { event.preventDefault(); event.stopPropagation(); setDismissed({ error }) }}>×</button>}
    {children}
    {retry && <AiRetry run={retry} />}
  </Tag>
}
