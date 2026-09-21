import { errorDetails } from '../../platform/diagnostics/error-details'
import { useI18n } from '../localization/i18n'

/** Metadata has already crossed the native redaction boundary. Render as text. */
export function ResponseDetails({ value }: { value?: unknown }) {
  const tr = useI18n()
  if (value == null) return null
  return <details className="response-details"><summary>{tr('Response details')}</summary><pre>{JSON.stringify(value instanceof Error ? errorDetails(value) : value, null, 2)}</pre></details>
}
