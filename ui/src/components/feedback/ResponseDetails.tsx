import { useI18n } from '../localization/i18n'

/** Metadata has already crossed the native redaction boundary. Render as text. */
export function ResponseDetails({ value }: { value?: unknown }) {
  const tr = useI18n()
  if (value == null) return null
  return <details><summary>{tr('Response details')}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
}
