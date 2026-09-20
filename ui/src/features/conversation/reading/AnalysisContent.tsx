import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { MixedText } from '../../../components/reading/MixedText'
import { Markdown } from '../../../components/reading/Markdown'
import { useI18n } from '../../../components/localization/i18n'
import { AnalysisSentence } from './AnalysisSentence'
import { ReadingPassage } from './ReadingPassage'
import { ReadingExample } from './ReadingExample'
import { SavedReadingProvider } from '../../../components/reading/SavedReadingProvider'
import { useReadingScope } from '../../../components/reading/ReadingContext'
import { anchoredTokenGlosses } from '../../../domain/reading/gloss-display'
import { memo, useMemo } from 'react'
import { HelpStatus, useHelpRequest } from '../composer/HelpRequest'
import { requestReplyHelp } from '../composer/TurnReplyHelp'
import { MessageReadingScope } from './MessageReadingScope'
import { useNavigationStore } from '../../../state/navigation/navigation'
import type { StoredTurn } from '../../../types'

export interface InspectTarget {
  turn: number
  side: 'me' | 'bot'
  index: number
}

/// Just the parts of a turn this pane renders. Deriving from `StoredTurn` keeps
/// this view synchronized with the canonical shape.
export type AnalysedTurn = Pick<StoredTurn, 'id' | 'user' | 'analysisState' | 'assistant' | 'userSavedGloss' | 'userTranslation' | 'turnId'>

interface AnalysisContentProps {
  conversationId?: string
  onAsk?: (question: string) => void
  turn: AnalysedTurn
  inspect: InspectTarget | null
  nativeLanguageName: string
  showRomanization: boolean
  rtl: boolean
}

/// The pinned turn's full breakdown: learner words, tutor words, per-token
/// gloss lists, grammar mechanics, and the analysis Q&A thread.
export const AnalysisContent = memo(function AnalysisContent({
  turn,
  conversationId,
  onAsk,
  inspect: _inspect,
  nativeLanguageName,
  showRomanization: _showRomanization,
  rtl: _rtl,
}: AnalysisContentProps) {
  const tr = useI18n()
  const scope = useReadingScope()
  const a = turn.assistant
  const lane = a?.help?.lanes.grammar ?? { state: a?.explanationsState ?? null }
  const eligible = a?.messageId && conversationId && !['cancelled','invalidated'].includes(lane.state ?? '')
  const request = useHelpRequest(lane, eligible ? () => requestReplyHelp(conversationId!, a!.messageId!, 'grammar') : undefined)
  const sources = useMemo(() => scope && a ? [
    {scope:a.help?.scope ?? scope, text:a.reply, segments:a.savedGloss?.segments ?? anchoredTokenGlosses(a.reply,a.tokens)},
    ...(turn.user ? [{scope:a.help?.scope ?? scope,text:turn.user,segments:turn.userSavedGloss?.segments ?? anchoredTokenGlosses(turn.user,a.user_tokens)}] : []),
  ] : [], [scope, a, turn.user, turn.userSavedGloss])
  if (!a) return <>
    {turn.user && <AnalysisSentence label={tr("You said")} text={turn.user} gloss={turn.userSavedGloss} translation={turn.userTranslation} />}
    <p className="center-note">{tr("No partner reply yet.")}</p>
  </>

  return (
    <MessageReadingScope scope={a.help?.scope}><SavedReadingProvider sources={sources}>
      {!a.help && ['ready', 'running', 'waiting_dependencies'].includes(a.explanationsState ?? '') && (
        <p className="sect-k pending" data-phase={a.explanationsState === 'running' ? 'running' : 'waiting'}>
          {tr("⟳ Analyzing grammar…")}</p>
      )}

      {turn.user && <AnalysisSentence label={tr("You said")} text={turn.user} gloss={turn.userSavedGloss} tokens={a.user_tokens} translation={turn.userTranslation ?? a.user_translation} />}
      <AnalysisSentence label={tr("Partner replied")} side="bot" text={a.reply} gloss={a.savedGloss} tokens={a.tokens} translation={a.translation} />

      {!a.help && a.explanationsError && <ErrorDetails label={tr("Message analysis")} errorKey={a.explanationsError}>{a.explanationsError}</ErrorDetails>}
      {a.errors.length > 0 && (
        <div className="turn-errors">
          {a.errors.map((e, i) => (
            <ErrorDetails key={i} label={tr("Message analysis")} errorKey={e}>{e}</ErrorDetails>
          ))}
        </div>
      )}

      {a.help && <>
        {eligible && lane.state === null && <button className="btn" disabled={request.pending} onClick={request.toggle}>{tr('Explain grammar')}</button>}
        <HelpStatus lane={lane} pending={request.pending} failure={request.failure} label={tr('Working out the grammar…')}
          onRetry={eligible ? () => request.submit(() => requestReplyHelp(conversationId!, a.messageId!, 'grammar', true)) : undefined}
          onInspect={conversationId ? () => useNavigationStore.getState().inspectAi({conversationId, turnId:turn.turnId ?? null, operationKind:'reply_explanations'}) : undefined} />
        {a.help.grammar?.cards.length === 0 && lane.state === 'succeeded' && <p>{tr('Nothing to flag in this reply.')}</p>}
      </>}
      {a.mechanics.length > 0 && (
        <>
          <p className="sect-k">{tr("What's happening")}</p>
          {a.mechanics.map((mech) => (
            <div key={mech.title} className="exp">
              <div className="exp-top">
                <span className="exp-title">{mech.title}</span>
                {mech.cefr && <span className="exp-cefr">{mech.cefr}</span>}
              </div>
              {mech.quote && <ReadingPassage key={mech.quote} text={mech.quote} />}
              <Markdown text={mech.body} onTerm={onAsk ? term => onAsk(`Explain [[${term}]] in this partner message: ${a.reply}. Saved explanation: ${JSON.stringify(mech)}`) : undefined} />
              {mech.example && <ReadingExample text={mech.example} />}
              {mech.contrast && (
                <p className="exp-vs">
                  <span>{tr("vs ")}{nativeLanguageName || tr("your language")}</span>
                  <MixedText text={mech.contrast} />
                </p>
              )}
            </div>
          ))}
        </>
      )}

    </SavedReadingProvider></MessageReadingScope>
  )
})
