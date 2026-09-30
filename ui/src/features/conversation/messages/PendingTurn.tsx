import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { useI18n } from '../../../components/localization/i18n'
import type { ReplyState } from '../../../domain/conversation/reply-state'
import type { PendingMessage } from '../session/usePendingMessage'
import { PendingBubble } from './PendingBubble'
import { ReplyStatus } from './ReplyStatus'
import { RequestFailure } from './RequestFailure'
import { useReadingPreferences } from '../../../components/reading/ReadingPreferences'
import { StableTurn } from './StableTurn'

export const WAITING_REPLY: ReplyState = { state: 'pending', error: null, control: null }

/** Keep the learner's reading aids and feedback row reserved before acceptance. */
export function PendingLearner({ message, rtl }: { message: PendingMessage; rtl: boolean }) {
  const tr = useI18n()
  const { autoTranslate, alwaysRomanize, alwaysPronunciation } = useReadingPreferences()
  const progress = message.phase === 'transcribing' ? tr("Transcribing…") : message.phase === 'sending' ? tr("Sending…") : null
  return <>
    <PendingBubble side="me" arriving={!message.editing} text={message.text} rtl={rtl}
      aids={autoTranslate || alwaysRomanize || alwaysPronunciation} translationSlot={autoTranslate}
      activity={progress && <ActivityIndicator compact label={progress} />} />
    <div className="message-feedback-line" aria-hidden="true"><span className="feedback-badge pending-feedback"><ActivityIndicator label={tr("Analyzing…")} /></span></div>
  </>
}

/** A sent message before native storage has it, laid out as the turn it will
 * become. The learner's bubble appears at once and fills in as its text arrives;
 * once the message goes out as a request, the partner's bubble appears under it.
 * The landed turn then takes the same place. */
export function PendingTurn({ message, rtl, onOpenSettings, onDismiss }: {
  message: PendingMessage; rtl: boolean; onOpenSettings?: () => void; onDismiss: () => void
}) {
  return <StableTurn className="turn-stack" data-pending={message.phase} data-editing={message.editing ? '' : undefined}>
    <div className="learner-turn">
      <PendingLearner message={message} rtl={rtl} />
      {message.phase === 'failed' && message.failure && <RequestFailure error={message.failure} onOpenSettings={onOpenSettings} onRetry={message.retry} onDismiss={onDismiss} />}
    </div>
    {message.phase === 'sending' && <ReplyStatus reply={WAITING_REPLY} rtl={rtl} arriving={!message.editing} />}
  </StableTurn>
}
