import { useId, useState } from 'react'
import type { ReplyExplanation, AssistedReply, ReplyHelpKind } from '../../../generated/contracts'
import { Markdown } from '../../../components/reading/Markdown'
import { TargetPhrase } from '../../../components/reading/TargetPhrase'
import { TargetMessage } from '../../../components/reading/TargetMessage'
import { ReadingExample } from '../../../components/reading/ReadingExample'
import { MixedText } from '../../../components/reading/MixedText'
import type { HelpLane } from '../../../domain/conversation/reply-help'
import { useHelpRequest, HelpStatus } from './HelpRequest'
import { useI18n } from '../../../components/localization/i18n'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'


/** Three independent help lanes; rendering and opening saved data never generate. */
export function ReplyHelp({ brief, briefPending = false, onAsk, grammar, onExplainGrammar,
  replies, starters, onSuggestReply, opened = [], busy, errors, onUse, lanes, onRetry, onInspect }: {
  lanes?: Record<ReplyHelpKind, HelpLane>
  onRetry?: (kind: ReplyHelpKind) => Promise<void>
  onInspect?: () => void
  brief?: string
  briefPending?: boolean
  onAsk?: (question: string) => void
  grammar?: ReplyExplanation[]
  onExplainGrammar?: () => Promise<void>
  replies?: AssistedReply[]
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
  const id = useId()
  // Saved or arriving results never open the tray; only explicit fixture states do.
  const [open, setOpen] = useState(() => opened.length > 0)
  const grammarLane = lanes?.grammar ?? { state: grammar === undefined ? null : 'succeeded' }
  const repliesLane = lanes?.replies ?? { state: replies === undefined ? null : 'succeeded' }
  const briefLane = lanes?.brief ?? { state: briefPending ? 'running' : brief ? 'succeeded' : null }
  const explain = useHelpRequest(grammarLane, onExplainGrammar, opened.includes('grammar'))
  const suggest = useHelpRequest(repliesLane, onSuggestReply, opened.includes('replies'))
  const summary = useHelpRequest(briefLane)
  const status = (kind: ReplyHelpKind, request: typeof explain, lane: HelpLane, label: string) => <HelpStatus lane={lane} pending={request.pending} failure={request.failure} label={label} onInspect={onInspect}
    onRetry={onRetry ? () => request.submit(() => onRetry(kind)) : undefined} />
  if (!brief && !briefPending && !onExplainGrammar && !onSuggestReply && !errors.length && !grammar && !replies && !starters?.length && !lanes) return null
  if (!open) return <div className="reply-help-folded">
    <button type="button" className="reply-help-open" aria-expanded={false} aria-controls={id}
      onClick={() => setOpen(true)}><ToolbarIcon name="idea" size={15} />{tr("Help with this reply")}</button>
  </div>

  return <section id={id} className="reply-help" aria-label={tr("Help with this reply")}>
    <div className="reply-help-brief">
      {brief
        ? <Markdown text={brief} onTerm={onAsk ? term => onAsk(`Explain [[${term}]] in this conversation.`) : undefined} />
        : briefPending ? null
        : <p className="reply-help-empty">{tr("No brief for this turn yet.")}</p>}
      <button type="button" className="reply-help-hide" aria-expanded={true} aria-controls={id}
        aria-label={tr("Hide reply help")} title={tr("Hide reply help")} onClick={() => setOpen(false)}>
        <ToolbarIcon name="chevron" size={16} />
      </button>
    </div>

    {status('brief', summary, briefLane, tr('Reading the conversation…'))}
    <div className="reply-help-actions">
      <HelpAction icon="reading" label={tr("Explain grammar")} request={explain} controls={`${id}-grammar`} />
      <HelpAction icon="idea" label={tr("Suggest a reply")} request={suggest} controls={`${id}-replies`} />
    </div>

    {explain.shown && <div id={`${id}-grammar`} className="reply-help-panel" aria-live="polite" aria-busy={explain.pending}>
      {status('grammar', explain, grammarLane, tr('Working out the grammar…'))}
      {grammar?.map(card => <article className="grammar-card" key={card.title}>
        <h4 className="grammar-title"><MixedText text={card.title} /></h4>
        {card.quote && <TargetMessage layout="compact" text={card.quote} segments={[]} segmentsKey={card.quote} translation={null} romanization={null} pronunciation={null} translateLabel={null} segmentsPending={false} lookupWords status={null} annotation={null} speech={null} analysis={null} focused={false} rtl={false} />}
        <Markdown text={card.body} onTerm={onAsk ? term => onAsk(`Explain [[${term}]] in this conversation.`) : undefined} />
        {card.example && <ReadingExample text={card.example} compact />}
        {card.contrast && <p className="grammar-contrast"><MixedText text={card.contrast} /></p>}
      </article>)}
      {grammar?.length === 0 && !explain.pending && <p className="reply-help-empty">{tr("Nothing to flag in this reply.")}</p>}
    </div>}

    {suggest.shown && <div id={`${id}-replies`} className="reply-help-panel" aria-live="polite" aria-busy={suggest.pending}>
      {status('replies', suggest, repliesLane, tr('Writing reply ideas…'))}
      {replies && replies.length > 0 && <ul className="help-replies" aria-label={tr("Suggested replies")}>
        {replies.map(reply => <li className="help-reply" key={reply.text}>
          <div className="help-reply-text"><TargetMessage layout="compact" text={reply.text} segments={[]} segmentsKey={reply.text} translation={reply.translation} romanization={reply.romanization} pronunciation={reply.pronunciation} translateLabel={null} segmentsPending={false} lookupWords status={null} annotation={null} speech={null} analysis={null} focused={false} rtl={false} /></div>
          <button type="button" className="help-insert" disabled={busy} title={tr("Insert reply")}
            aria-label={tr("Insert reply: {value0}", { value0: reply.text })}
            onClick={() => onUse(reply.text, 'suggestion')}><span aria-hidden="true">↗</span></button>
        </li>)}
      </ul>}
      {starters && starters.length > 0 && <div className="help-starters">
        <span className="help-starters-label">{tr("Sentence starters")}</span>
        <ul>{starters.map(text => <li key={text}>
          <span className="help-starter"><TargetPhrase text={text} /><button type="button" className="help-insert" disabled={busy}
            aria-label={tr("Insert starter: {value0}", { value0: text })}
            onClick={() => onUse(text, 'scaffold')}><span aria-hidden="true">↗</span></button></span>
        </li>)}</ul>
      </div>}
    </div>}

    {errors.length > 0 && <ErrorDetails label={tr("Reply help")} errorKey={JSON.stringify(errors)}>{errors.join(' · ')}</ErrorDetails>}
  </section>
}

function HelpAction({ icon, label, request, controls }: {
  icon: 'reading' | 'idea'; label: string; request: ReturnType<typeof useHelpRequest>; controls: string
}) {
  return <button type="button" className="reply-help-action" aria-expanded={request.shown} aria-controls={controls}
    data-busy={request.pending || undefined} onClick={request.toggle}>
    <ToolbarIcon name={icon} size={16} />
    <span>{label}</span>
    <ToolbarIcon name="chevron" size={14} />
  </button>
}
