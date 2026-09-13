import { ErrorDetails } from '../../ui/ErrorDetails'
import { ActivityIndicator } from '../../ui/ActivityIndicator'
import { useState } from 'react'
import { nativeError } from '../../platform/ipc/workspace'
import { SavedGlossText } from './SavedGlossText'
import type { SuggestedReply } from '../../contracts'

/// Reply ideas for the latest persona message, with saved word glosses. Inserting
/// fills the draft; it never sends. The panel folds down to one button at the
/// inline end of the composer, directly above the record button, so a phone held
/// in the right hand can reopen it with the thumb.
export function ComposerHelp({ replies, pending, busy, errors, onUse, onRequest }: {
  onRequest?: () => Promise<void>
  replies: SuggestedReply[]; pending: boolean; busy: boolean; errors: string[]
  onUse: (text: string, source: 'suggestion') => void
}) {
  const visibleReplies = replies.slice(0, 2)
  const [collapsed, setCollapsed] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  async function toggle() {
    if (!collapsed) { setCollapsed(true); return }
    setCollapsed(false)
    if (replies.length || pending || requesting || !onRequest) return
    setRequesting(true); setFailure(null)
    try { await onRequest() } catch (error) { setFailure(nativeError(error)) } finally { setRequesting(false) }
  }
  if (!onRequest && !replies.length && !pending && !errors.length) return null
  const toggleButton = <button type="button" className="composer-help-toggle" aria-expanded={!collapsed} aria-controls="composer-help-content"
    onClick={() => void toggle()}>{collapsed ? 'Show suggested replies' : 'Hide suggested replies'}</button>
  if (collapsed) return <div className="composer-help-folded">{toggleButton}</div>
  return <section id="composer-help-content" className="composer-help-content" aria-label="Reply ideas" aria-live="polite" aria-busy={pending}>
    <div className="composer-help-head">{toggleButton}</div>
    {replies.length > 0 && <div className="help-replies" aria-label="Suggested replies">
      {visibleReplies.map(reply => <div className="help-reply" key={reply.text}>
        <span className="help-reply-text" dir="auto"><SavedGlossText text={reply.text} segments={reply.segments} /></span>
        <button type="button" className="help-insert" aria-label={`Insert reply: ${reply.text}`} title="Insert reply" disabled={busy} onClick={() => onUse(reply.text, 'suggestion')}><span aria-hidden="true">↗</span></button>
      </div>)}
    </div>}
    {(pending || requesting) && <ActivityIndicator compact label="Finding reply ideas…" />}
    {failure && <p role="alert">{failure}</p>}
    {errors.length > 0 && <ErrorDetails label="Reply ideas" errorKey={JSON.stringify(errors)}>{errors.join(' · ')}</ErrorDetails>}
  </section>
}
