import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { useI18n } from '../../../components/localization/i18n'
import type { ReplyState } from '../../../domain/conversation/reply-state'
import type { PendingMessage } from '../session/usePendingMessage'
import { PendingBubble } from './PendingBubble'
import { ReplyStatus } from './ReplyStatus'
import { RequestFailure } from './RequestFailure'

const WAITING: ReplyState = { state: 'pending', error: null, control: null }

/** A sent message before native storage has it, laid out as the turn it will
 * become. The learner's bubble grows into place at once and fills in as its text
 * arrives; once the message goes out as a request, the partner's bubble grows in
 * under it. The landed turn then takes the same place. */
export function PendingTurn({ message, rtl, onOpenSettings, onDismiss }: {
  message: PendingMessage; rtl: boolean; onOpenSettings?: () => void; onDismiss: () => void
}) {
  const tr = useI18n()
  const progress = message.phase === 'transcribing' ? tr("Transcribing…") : message.phase === 'sending' ? tr("Sending…") : null
  return <div className="turn-stack" data-pending={message.phase}>
    <div className="learner-turn">
      <PendingBubble side="me" arriving text={message.text} rtl={rtl} activity={progress && <ActivityIndicator compact label={progress} />} />
      {message.phase === 'failed' && message.failure && <RequestFailure error={message.failure} onOpenSettings={onOpenSettings} onRetry={message.retry} onDismiss={onDismiss} />}
    </div>
    {message.phase === 'sending' && <ReplyStatus reply={WAITING} rtl={rtl} arriving />}
  </div>
}
