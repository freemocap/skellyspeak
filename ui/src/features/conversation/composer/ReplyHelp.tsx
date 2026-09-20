import { useState } from 'react'
import type { ReplyExplanation, SuggestedReply } from '../../../generated/contracts'
import { Markdown } from '../../../components/reading/Markdown'
import { TargetText } from '../../../components/reading/TargetText'
import { SavedGlossText } from '../reading/SavedGlossText'
import { useI18n } from '../../../components/localization/i18n'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { nativeError } from '../../../platform/ipc/workspace'

/// Help with the reply the learner is about to write, in three layers.
///
/// Opening the tray shows only the brief: what the partner just did and what a
/// reply needs to do. Grammar and worked replies are peer requests beside it —
/// neither is computed until the learner asks, so an unopened tray costs no
/// tokens. Inserting fills the draft; it never sends.
export function ReplyHelp({ brief, briefPending = false, onAsk, grammar, onExplainGrammar,
  replies, starters, onSuggestReply, opened = [], busy, errors, onUse }: {
  brief?: string
  briefPending?: boolean
  onAsk?: (question: string) => void
  grammar?: ReplyExplanation[]
  onExplainGrammar?: () => Promise<void>
  replies?: SuggestedReply[]
  starters?: string[]
  onSuggestReply?: () => Promise<void>
  /// Disclosures to start open. The learner owns them after the first render;
  /// this is for rendering a named state directly — previews and deep links.
  opened?: ReadonlyArray<'grammar' | 'replies'>
  busy: boolean
  errors: string[]
  onUse: (text: string, source: 'suggestion' | 'scaffold') => void
}) {
  const tr = useI18n()
  // The brief is computed with the partner's reply, so an arriving turn opens
  // the tray to it. The two requests below stay closed either way.
  const [open, setOpen] = useState(brief !== undefined || briefPending)
  const explain = useRequest(grammar !== undefined, onExplainGrammar, opened.includes('grammar'))
  const suggest = useRequest(replies !== undefined, onSuggestReply, opened.includes('replies'))

  if (!brief && !briefPending && !onExplainGrammar && !onSuggestReply && !errors.length) return null
  if (!open) return <div className="reply-help-folded">
    <button type="button" className="reply-help-open" aria-expanded={false} aria-controls="reply-help"
      onClick={() => setOpen(true)}><ToolbarIcon name="idea" size={15} />{tr("Help with this reply")}</button>
  </div>

  return <section id="reply-help" className="reply-help" aria-label={tr("Help with this reply")}>
    <div className="reply-help-brief">
      {brief
        ? <Markdown text={brief} onTerm={onAsk ? term => onAsk(`Explain [[${term}]] in this conversation.`) : undefined} />
        : briefPending ? <ActivityIndicator label={tr("Reading the conversation…")} />
        : <p className="reply-help-empty">{tr("No brief for this turn yet.")}</p>}
      <button type="button" className="reply-help-hide" aria-expanded={true} aria-controls="reply-help"
        aria-label={tr("Hide reply help")} title={tr("Hide reply help")} onClick={() => setOpen(false)}>
        <ToolbarIcon name="chevron" size={16} />
      </button>
    </div>

    <div className="reply-help-actions">
      <HelpAction icon="reading" label={tr("Explain grammar")} request={explain} controls="reply-help-grammar" />
      <HelpAction icon="idea" label={tr("Suggest a reply")} request={suggest} controls="reply-help-replies" />
    </div>

    {explain.shown && <div id="reply-help-grammar" className="reply-help-panel" aria-live="polite" aria-busy={explain.running}>
      {explain.running && <ActivityIndicator label={tr("Working out the grammar…")} />}
      {explain.failure && <p role="alert" className="reply-help-failure">{explain.failure}</p>}
      {grammar?.map(card => <article className="grammar-card" key={card.title}>
        <h4 className="grammar-title">{card.title}</h4>
        {card.quote && <p className="grammar-quote" dir="auto"><TargetText text={card.quote} /></p>}
        <Markdown text={card.body} onTerm={onAsk ? term => onAsk(`Explain [[${term}]] in this conversation.`) : undefined} />
        {card.example && <p className="grammar-example" dir="auto"><TargetText text={card.example} /></p>}
        {card.contrast && <p className="grammar-contrast">{card.contrast}</p>}
      </article>)}
      {grammar?.length === 0 && !explain.running && <p className="reply-help-empty">{tr("Nothing to flag in this reply.")}</p>}
    </div>}

    {suggest.shown && <div id="reply-help-replies" className="reply-help-panel" aria-live="polite" aria-busy={suggest.running}>
      {suggest.running && <ActivityIndicator label={tr("Writing reply ideas…")} />}
      {suggest.failure && <p role="alert" className="reply-help-failure">{suggest.failure}</p>}
      {replies && replies.length > 0 && <ul className="help-replies" aria-label={tr("Suggested replies")}>
        {replies.map(reply => <li className="help-reply" key={reply.text}>
          <span className="help-reply-text" dir="auto"><SavedGlossText text={reply.text} segments={reply.segments} /></span>
          <button type="button" className="help-insert" disabled={busy} title={tr("Insert reply")}
            aria-label={tr("Insert reply: {value0}", { value0: reply.text })}
            onClick={() => onUse(reply.text, 'suggestion')}><span aria-hidden="true">↗</span></button>
        </li>)}
      </ul>}
      {starters && starters.length > 0 && <div className="help-starters">
        <span className="help-starters-label">{tr("Sentence starters")}</span>
        <ul>{starters.map(text => <li key={text}>
          <button type="button" className="help-starter" disabled={busy}
            aria-label={tr("Insert starter: {value0}", { value0: text })}
            onClick={() => onUse(text, 'scaffold')}><span dir="auto"><TargetText text={text} /></span></button>
        </li>)}</ul>
      </div>}
    </div>}

    {errors.length > 0 && <ErrorDetails label={tr("Reply help")} errorKey={JSON.stringify(errors)}>{errors.join(' · ')}</ErrorDetails>}
  </section>
}

type Request = { shown: boolean; running: boolean; failure: string | null; toggle: () => void }

/// One on-demand request: closed until asked, then kept open with whatever it
/// produced. `satisfied` means the answer is already in the snapshot, so
/// reopening never asks the model twice.
function useRequest(satisfied: boolean, run?: () => Promise<void>): Request {
  const [shown, setShown] = useState(false)
  const [running, setRunning] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  return {
    shown, running, failure,
    toggle: () => {
      if (shown) { setShown(false); return }
      setShown(true)
      if (satisfied || running || !run) return
      setRunning(true); setFailure(null)
      void run().catch((reason: unknown) => setFailure(nativeError(reason))).finally(() => setRunning(false))
    },
  }
}

function HelpAction({ icon, label, request, controls }: {
  icon: 'reading' | 'idea'; label: string; request: Request; controls: string
}) {
  return <button type="button" className="reply-help-action" aria-expanded={request.shown} aria-controls={controls}
    data-busy={request.running || undefined} onClick={request.toggle}>
    <ToolbarIcon name={icon} size={16} />
    <span>{label}</span>
    <ToolbarIcon name="chevron" size={14} />
  </button>
}
