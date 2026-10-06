import type { ReactNode } from 'react'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { useI18n } from '../../../components/localization/i18n'

/** Partner identity leads; the conversation list opens from the start of the
 * header, with difficulty beside the partner and secondary settings in the panel. */
export function ConversationHeader({ leading, persona, difficulty, error, children }: {
  leading?: ReactNode; persona: ReactNode; difficulty?: ReactNode; error: string | null; children: ReactNode
}) {
  const tr = useI18n()
  return <div className="chat-head">
    {leading}
    <div className="conversation-title">
      <div className="conversation-identity">{persona}{difficulty}</div>
      {error && <ErrorDetails label={tr("Conversation settings")} errorKey={error}>{error}</ErrorDetails>}
    </div>
    {children}
  </div>
}
