import { useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { useOnboardingStore } from '../../../state/settings/onboarding'
import { nativeError } from '../../../platform/ipc/workspace'

/** Optional help follows real conversation state; it never starts work or moves focus. */
export function ConversationHelp({ hasReply, hasLearnerTurn }: { hasReply: boolean; hasLearnerTurn: boolean }) {
  const tr = useI18n()
  const shown = useOnboardingStore(state => state.preferences?.onboardingHelp ?? false)
  const busy = useOnboardingStore(state => state.busy)
  const [error, setError] = useState('')
  if (!shown) return null
  return <aside className="conversation-help" aria-label={tr('Conversation help')}>
    <p>{hasLearnerTurn ? tr('Open Coaching to review your turn. Feedback may still be processing.') : hasReply
      ? tr('Select a word for help when word help is ready. Use the reply controls for ideas, or record or type your own reply.')
      : tr('Let your partner start, or record or type a message. You can change the difficulty at any time.')}</p>
    <button className="btn tiny" disabled={busy} onClick={() => {
      setError('')
      void useOnboardingStore.getState().showHelp(false).catch(reason => setError(nativeError(reason)))
    }}>{tr('Dismiss help')}</button>
    {error && <p role="alert">{error}</p>}
  </aside>
}
