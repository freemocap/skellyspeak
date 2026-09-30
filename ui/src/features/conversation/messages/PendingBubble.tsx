import { useMessageToolDefinitions } from '../../../components/reading/useMessageToolDefinitions'
import type { ReactNode } from 'react'
import { useReadingAidSpace } from '../../../components/reading/ReadingPreferences'
import { MessageTools } from '../../../components/reading/MessageTools'
import { useReadAloud } from '../../../components/reading/useReadAloud'
import { AddToDrillButton } from '../../../components/reading/AddToDrillButton'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useI18n } from '../../../components/localization/i18n'

/// Exact received source, optionally revealed a word at a time. The hidden tail
/// reserves its known layout; assistive technology receives the complete source.
export function ReceivedText({ text, visibleText = text, streaming, rtl }: { text: string; visibleText?: string; streaming: boolean; rtl?: boolean }) {
  return <p className={streaming ? 'reply-received target-text streaming' : 'reply-received target-text'} dir={rtl ? 'rtl' : 'auto'}>
    {visibleText === text ? text : <><span className="hydrating-announce">{text}</span><span aria-hidden="true">{visibleText}<span className="reply-unrevealed">{text.slice(visibleText.length)}</span></span></>}
  </p>
}

/** A message held open before its content lands, for either speaker. One bubble
 * shape from the first frame: a reading line that fills with the text as it
 * arrives, then the footer where the landed message's actions will sit, holding
 * its progress. Reading aids set to show reserve their place too: the annotated
 * line pitch and the translation line. `arriving` fades the bubble into place;
 * a bubble that replaces an existing one leaves it off. */
export function PendingBubble({ side, text, visibleText, streaming = false, rtl, activity, arriving = false, aids = false, translationSlot = false }: {
  side: 'me' | 'bot'; text: string | null; streaming?: boolean; rtl?: boolean; activity: ReactNode
  visibleText?: string
  arriving?: boolean; aids?: boolean; translationSlot?: boolean
}) {
  const aidSpace = useReadingAidSpace()
  const tr = useI18n()
  const messageTools = useMessageToolDefinitions()
  const readAloud = useReadAloud(text ?? '')
  const noop = () => {}
  return <div style={aidSpace} className={`msg chat-message ${side} with-actions${side === 'bot' ? ' with-corner-control' : ''} reply-pending${aids ? ' aids-reserved' : ''}${rtl ? ' rtl' : ''}${text ? ' is-hydrating' : ''}`}
    data-arriving={arriving ? '' : undefined} aria-busy="true">
    {text ? <ReceivedText text={text} visibleText={visibleText} streaming={streaming} rtl={rtl} /> : <p className="reply-received target-text reply-placeholder" aria-hidden="true" />}
    {translationSlot && <div className="trans hydrating-slot" data-phase="waiting" aria-hidden="true"><span className="hydrating-label">{tr("Translating…")}</span><span className="hydrating-line" /></div>}
    <MessageTools pending={activity} play={side === 'bot' || readAloud ? { playing: false, onToggle: noop } : null} inspect={null}
      tools={[{ key: 'translate', label: tr("Translate"), onSelect: noop }]}
      more={[messageTools.words({ onSelect: noop }), messageTools.details(side === 'me' ? 'coach' : 'analysis', { onSelect: noop })]}
      actions={<>{side === 'me' && <button type="button" disabled className="message-tools-icon"><ToolbarIcon name="edit" /></button>}<AddToDrillButton text={text ?? ''} /></>} />
  </div>
}
