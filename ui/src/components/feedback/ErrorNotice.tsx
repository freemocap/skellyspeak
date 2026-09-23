import { useState, type ReactNode } from 'react'
import { useI18n } from '../localization/i18n'

/** Dismiss only the presentation; a new failure becomes visible independently. */
export function ErrorNotice({ error, children, as: Tag = 'div', className = '' }: {
  error: unknown
  children: ReactNode
  as?: 'div' | 'p' | 'span'
  className?: string
}) {
  const tr = useI18n()
  const [dismissed, setDismissed] = useState<{ error: unknown } | null>(null)
  if (dismissed && Object.is(dismissed.error, error)) return null
  return <Tag role="alert" className={`error-notice ${className}`}>
    <button type="button" className="error-dismiss" aria-label={tr('Dismiss error')} title={tr('Dismiss error')}
      onClick={event => { event.preventDefault(); event.stopPropagation(); setDismissed({ error }) }}>×</button>
    {children}
  </Tag>
}
