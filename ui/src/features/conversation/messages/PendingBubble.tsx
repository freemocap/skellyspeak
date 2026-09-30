import type { ReactNode } from 'react'

/// Text that arrived for a message: shown exactly as received, in one plain node,
/// the moment it arrives. Complete words are never held back. It uses the
/// landed message's reading typography, so the swap does not rewrap the text.
export function ReceivedText({ text, streaming, rtl }: { text: string; streaming: boolean; rtl?: boolean }) {
  return <p className={streaming ? 'reply-received target-text streaming' : 'reply-received target-text'} dir={rtl ? 'rtl' : 'auto'}>{text}{streaming && <span className="stream-caret" aria-hidden="true" />}</p>
}

/** A message held open before its content lands, for either speaker. One bubble
 * shape from the first frame: a reading line that fills with the text as it
 * arrives, then the footer where the landed message's actions will sit, holding
 * its progress. Reading aids set to show reserve their place too: the annotated
 * line pitch and the translation line. `arriving` grows the bubble into place;
 * a bubble that replaces one which already grew leaves it off. */
export function PendingBubble({ side, text, streaming = false, rtl, activity, arriving = false, aids = false, translationSlot = false }: {
  side: 'me' | 'bot'; text: string | null; streaming?: boolean; rtl?: boolean; activity: ReactNode
  arriving?: boolean; aids?: boolean; translationSlot?: boolean
}) {
  return <div className={`msg chat-message ${side} with-actions${side === 'bot' ? ' with-corner-control' : ''} reply-pending${aids ? ' aids-reserved' : ''}${text ? ' is-hydrating' : ''}`}
    data-arriving={arriving ? '' : undefined} aria-busy="true">
    {text ? <ReceivedText text={text} streaming={streaming} rtl={rtl} /> : <p className="reply-received target-text reply-placeholder" aria-hidden="true" />}
    {translationSlot && <div className="trans hydrating-slot" data-phase="waiting" aria-hidden="true"><span className="hydrating-line" /></div>}
    <div className="message-actions reply-activity" role="status">{activity}</div>
  </div>
}
