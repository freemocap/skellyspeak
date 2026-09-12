import { ErrorDetails } from '../../ui/ErrorDetails'
import { ActivityIndicator } from '../../ui/ActivityIndicator'
import { useNavigationStore } from '../../state/navigation'
import { SavedGlossText } from './SavedGlossText'
import type { SuggestedReply } from '../../contracts'

/// Reply ideas for the latest persona message, with saved word glosses. Inserting
/// fills the draft; it never sends. The panel folds down to one button at the
/// inline end of the composer, directly above the record button, so a phone held
/// in the right hand can reopen it with the thumb.
export function ComposerHelp({ replies, pending, busy, errors, onUse }: {
  replies: SuggestedReply[]; pending: boolean; busy: boolean; errors: string[]
  onUse: (text: string, source: 'suggestion') => void
}) {
  const collapsed = useNavigationStore((state) => state.suggestionsCollapsed)
  const toggle = useNavigationStore((state) => state.toggleSuggestions)
  if (replies.length === 0 && !pending && errors.length === 0) return null
  const toggleButton = <button type="button" className="composer-help-toggle" aria-expanded={!collapsed} aria-controls="composer-help-content"
    aria-label={collapsed ? 'Show reply ideas' : 'Hide reply ideas'} title={collapsed ? 'Show reply ideas' : 'Hide reply ideas'} onClick={toggle}>
    <span aria-hidden="true">{collapsed ? '💬' : '▾'}</span>{collapsed && replies.length > 0 && <span className="composer-help-count">{replies.length}</span>}
  </button>
  if (collapsed) return <div className="composer-help-folded">{toggleButton}</div>
  return <section id="composer-help-content" className="composer-help-content" aria-label="Reply ideas" aria-live="polite" aria-busy={pending}>
    <div className="composer-help-head">{toggleButton}</div>
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
