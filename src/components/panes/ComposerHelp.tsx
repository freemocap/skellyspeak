import { ErrorDetails } from '../ErrorDetails'
import { ActivityIndicator } from '../ActivityIndicator'
import { SavedGlossText } from '../chat/SavedGlossText'
import type { SuggestedReply } from '../../contracts'

/// Reply ideas for the latest partner message, with saved word glosses. Inserting fills the draft; it never sends.
export function ComposerHelp({ replies, pending, busy, errors, onUse }: {
  replies: SuggestedReply[]; pending: boolean; busy: boolean; errors: string[]
  onUse: (text: string, source: 'suggestion') => void
}) {
  if (replies.length === 0 && !pending && errors.length === 0) return null
  return <section id="composer-help-content" className="composer-help-content" aria-label="Reply ideas" aria-live="polite" aria-busy={pending}>
    {replies.length > 0 && <div className="help-replies" aria-label="Suggested replies">
      {replies.map(reply => <div className="help-reply" key={reply.text}>
        <span className="help-reply-text" dir="auto"><SavedGlossText text={reply.text} segments={reply.segments} /></span>
        <button type="button" className="help-insert" aria-label={`Insert reply: ${reply.text}`} title="Insert reply" disabled={busy} onClick={() => onUse(reply.text, 'suggestion')}><span aria-hidden="true">↗</span></button>
      </div>)}
    </div>}
    {pending && <ActivityIndicator compact label="Finding reply ideas…" />}
    {errors.length > 0 && <ErrorDetails label="Reply ideas" errorKey={JSON.stringify(errors)}>{errors.join(' · ')}</ErrorDetails>}
  </section>
}
