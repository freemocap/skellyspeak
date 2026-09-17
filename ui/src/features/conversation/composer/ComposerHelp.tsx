import type { ReplyAssistance } from '../../../generated/contracts'
import { Markdown } from '../../../components/reading/Markdown'
import { useReadingPreferences } from '../../../components/reading/ReadingPreferences'
import { useI18n } from '../../../components/localization/i18n'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { useState } from 'react'
import { nativeError } from '../../../platform/ipc/workspace'
import { SavedGlossText } from '../reading/SavedGlossText'
import type { SuggestedReply } from '../../../generated/contracts'

/// Reply ideas for the latest persona message, with saved word glosses. Inserting
/// fills the draft; it never sends. The panel folds down to one button at the
/// inline end of the composer, directly above the record button, so a phone held
/// in the right hand can reopen it with the thumb.
export function ComposerHelp({ assistance, onAsk, replies, pending, busy, errors, onUse, onRequest }: {
  assistance?: ReplyAssistance
  onAsk?: (question: string) => void
  onRequest?: () => Promise<void>
  replies: SuggestedReply[]; pending: boolean; busy: boolean; errors: string[]
  onUse: (text: string, source: 'suggestion' | 'scaffold') => void
}) {
  const tr = useI18n()
  const reading = useReadingPreferences()
  const visibleReplies = replies.slice(0, 2)
  const [collapsed, setCollapsed] = useState(!assistance && replies.length === 0)
  const [requesting, setRequesting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  async function toggle() {
    if (!collapsed) { setCollapsed(true); return }
    setCollapsed(false)
    if (assistance || replies.length || pending || requesting || !onRequest) return
    setRequesting(true); setFailure(null)
    try { await onRequest() } catch (error) { setFailure(nativeError(error)) } finally { setRequesting(false) }
  }
  if (!assistance && !onRequest && !replies.length && !pending && !errors.length) return null
  const toggleButton = <button type="button" className="composer-help-toggle" aria-expanded={!collapsed} aria-controls="composer-help-content"
    onClick={() => void toggle()}>{collapsed ? tr("Show suggested replies") : tr("Hide suggested replies")}</button>
  if (collapsed) return <div className="composer-help-folded">{toggleButton}</div>
  return <section id="composer-help-content" className="composer-help-content" aria-label={tr("Reply ideas")} aria-live="polite" aria-busy={pending}>
    <div className="composer-help-head">{toggleButton}</div>
    {assistance && <>
      <Markdown text={assistance.explanation} onTerm={onAsk ? term => onAsk(`Explain [[${term}]] in this reply assistance: ${JSON.stringify(assistance)}`) : undefined} />
      <div className="help-replies">{assistance.replies.map(reply => <div className="help-reply" key={reply.text}>
        <div><span className="help-reply-text" dir="auto">{reply.text}</span>
          <p dir="auto">{reply.translation}</p>
          {reading.alwaysRomanize && reply.romanization && <p dir="auto">{reply.romanization}</p>}
          {reading.alwaysPronunciation && <p dir="auto">{reply.pronunciation}</p>}
          {(!reading.alwaysRomanize || !reading.alwaysPronunciation) && <details><summary>{tr("Reading help")}</summary>{!reading.alwaysRomanize && reply.romanization && <p dir="auto">{reply.romanization}</p>}{!reading.alwaysPronunciation && <p dir="auto">{reply.pronunciation}</p>}</details>}
        </div>
        <button type="button" className="help-insert" aria-label={tr("Insert reply: {value0}", {value0: reply.text})} disabled={busy} onClick={() => onUse(reply.text, 'suggestion')}>↗</button>
      </div>)}</div>
      <details><summary>{tr("Frames and starters")}</summary>{[...assistance.frames, ...assistance.starters].map(text => <div className="help-reply" key={text}><span dir="auto">{text}</span><button type="button" className="help-insert" aria-label={tr("Insert reply: {value0}", {value0: text})} disabled={busy} onClick={() => onUse(text, 'scaffold')}>↗</button></div>)}</details>
    </>}
    {!assistance && replies.length > 0 && <div className="help-replies" aria-label={tr("Suggested replies")}>
      {visibleReplies.map(reply => <div className="help-reply" key={reply.text}>
        <span className="help-reply-text" dir="auto"><SavedGlossText text={reply.text} segments={reply.segments} /></span>
        <button type="button" className="help-insert" aria-label={tr("Insert reply: {value0}", { value0: String(reply.text) })} title={tr("Insert reply")} disabled={busy} onClick={() => onUse(reply.text, 'suggestion')}><span aria-hidden="true">↗</span></button>
      </div>)}
    </div>}
    {(pending || requesting) && <ActivityIndicator compact label={tr("Finding reply ideas…")} />}
    {failure && <p role="alert">{failure}</p>}
    {errors.length > 0 && <ErrorDetails label={tr("Reply ideas")} errorKey={JSON.stringify(errors)}>{errors.join(' · ')}</ErrorDetails>}
  </section>
}
