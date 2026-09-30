import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import type { RetryAction } from '../../../components/feedback/AiRetry'
import { useI18n } from '../../../components/localization/i18n'
import { needsProviderSetup } from '../../../domain/access/providers'

/** A conversation request that failed: its explanation and, when the provider
 * still needs setting up, the way to Settings. A failed message also offers
 * Retry, and dismissing the error drops the message with it. */
export function RequestFailure({ error, onOpenSettings, onRetry, onDismiss }: {
  error: string; onOpenSettings?: () => void; onRetry?: RetryAction | null; onDismiss?: () => void
}) {
  const tr = useI18n()
  return <ErrorDetails label={tr("Request failed")} errorKey={error} explanation={error} onRetry={onRetry} onDismiss={onDismiss}>
    {/* A message that says "go to Settings" should take you there, rather than
        making you find the gear yourself. */}
    {onOpenSettings && needsProviderSetup(error) && (
      <button type="button" className="err-action" onClick={onOpenSettings}>{tr("Open Settings")}</button>
    )}
  </ErrorDetails>
}
