import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import type { AttemptView } from '../../generated/contracts'
import { useI18n } from '../../components/localization/i18n'

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** Read only known error envelopes from metadata already redacted by native. */
function providerErrors(diagnostics: unknown): string[] {
  const root = record(diagnostics)
  const response = record(root?.response) ?? root
  const choices = response?.choices
  const errors = [response?.error, ...(Array.isArray(choices) ? choices.map(choice => record(choice)?.error) : [])]
  return [...new Set(errors.flatMap(value => {
    const error = record(value)
    if (typeof error?.message !== 'string') return []
    const code = error.code
    return [typeof code === 'string' || typeof code === 'number' ? `${code}: ${error.message}` : error.message]
  }))]
}

/** Failure summaries precede long prompts; full metadata remains separately inspectable. */
export function AttemptFailure({ attempt }: { attempt: AttemptView | null }) {
  const tr = useI18n()
  if (!attempt || (!attempt.error && attempt.state !== 'failed')) return null
  const messages = providerErrors(attempt.diagnostics).filter(message => message !== attempt.error)
  return <ErrorNotice className="ai-error" error={`${attempt.id}:${attempt.error}:${messages.join(";")}`}>
    <p>{attempt.error || tr('Request failed')}</p>
    {messages.map(message => <p key={message}>{message}</p>)}
  </ErrorNotice>
}
