import type { ReactNode } from 'react'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { useI18n } from '../../../components/localization/i18n'

/** Partner identity leads; the conversation list opens from the start of the
 * header and editing controls live in the conversation popover. */
export function ConversationHeader({ leading, persona, error, children }: {
  leading?: ReactNode; persona: ReactNode; error: string | null; children: ReactNode
}) {
  const tr = useI18n()
  return <div className="chat-head">
    {leading}
    <div className="conversation-title">
      {persona}
      {error && <ErrorDetails label={tr("Conversation settings")} errorKey={error}>{error}</ErrorDetails>}
    </div>
    {children}
  </div>
}
