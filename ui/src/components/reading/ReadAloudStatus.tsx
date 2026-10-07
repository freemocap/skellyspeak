import { useContext, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ActivityIndicator } from '../feedback/ActivityIndicator'
import { AiRetry, type RetryAction } from '../feedback/AiRetry'
import { ErrorNotice } from '../feedback/ErrorNotice'
import { useFriendlyError } from '../feedback/FriendlyError'
import { ResponseDetails } from '../feedback/ResponseDetails'
import { ToolbarIcon } from '../controls/ToolbarIcon'
import { supportsPopover } from '../controls/popover-support'
import { useI18n } from '../localization/i18n'
import { ReadAloudSlotContext } from './ReadingContext'
import { errorDetails, errorMessage } from '../../platform/diagnostics/error-details'

/** The read-aloud status for reading speech: one line while audio loads or
 * plays, the failure as a card with Retry and Close, nothing after success.
 * Word and phrase read-aloud reaches no AI pill, so this is its only progress,
 * Stop and failure surface. It floats bottom-right in the top layer unless the
 * app offers a slot, a phone's recording panel, where it rises in flow and
 * never covers the recorder. */
export function ReadAloudStatus({ speaking, loading, error, within = null, onStop, onRetry, onClose }: {
  speaking: boolean
  /// Audio is still on its way; once it plays the line says so.
  loading: boolean
  error: unknown
  /// An open modal dialog's content: hosted inside it, the status floats above
  /// the dialog and stays interactive instead of inert.
  within?: HTMLElement | null
  onStop: () => void
  onRetry: RetryAction
  onClose: () => void
}) {
  const tr = useI18n()
  const friendly = useFriendlyError(error)
  const slot = useContext(ReadAloudSlotContext)
  const placement = !within && slot ? 'slot' : 'corner'
  const popover = placement === 'corner' && supportsPopover()
  const node = useRef<HTMLDivElement>(null)
  // Re-shown on each change so it stays above a dialog opened since it appeared,
  // and whenever its host changes, which gives it a fresh, still-hidden node.
  useLayoutEffect(() => {
    const element = node.current
    if (element && popover) { element.showPopover(); return () => { if (element.isConnected) element.hidePopover() } }
  }, [popover, speaking, error, within, slot])
  const failed = error != null
  return createPortal(<div ref={node} popover={popover ? 'manual' : undefined} className="reading-audio-status" data-reading-tools
    data-placement={placement} data-level={failed ? friendly.level : undefined}>
    {speaking && (loading ? <ActivityIndicator label={tr('Loading speech…')} />
      : <span className="reading-audio-line" role="status"><ToolbarIcon name="voice" size={16} />{tr('Reading aloud…')}</span>)}
    {speaking && <button type="button" className="btn" onClick={onStop}>{tr('Stop reading')}</button>}
    {failed && <ErrorNotice dismissible={false} onRetry={null} error={error}>{errorMessage(error)}<ResponseDetails value={errorDetails(error)} /></ErrorNotice>}
    {failed && <div className="reading-audio-actions"><AiRetry run={onRetry} /><button type="button" className="btn" onClick={onClose}>{tr('Close')}</button></div>}
  </div>, within ?? slot ?? document.body)
}
