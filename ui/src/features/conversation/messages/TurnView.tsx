import { AddToDrillButton } from './AddToDrillButton'
import { MessageXpButton } from '../progress/MessageXpButton'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useUiDirection } from '../../../components/localization/useUiDirection'
import { useI18n } from '../../../components/localization/i18n'
import { AnalysisSentence } from '../reading/AnalysisSentence'
import { anchoredTokenGlosses } from '../../../domain/reading/gloss-display'
import { EvidenceMappingNotice } from '../../../components/learning/EvidenceMappingNotice'
import { GlossAssistance } from '../reading/GlossAssistance'
import { SavedGlossText } from '../../../components/reading/SavedGlossText'
import { TargetMessage } from '../../../components/reading/TargetMessage'
import { useReadingPreferences } from '../../../components/reading/ReadingPreferences'
import { TargetText } from '../../../components/reading/TargetText'
import { ReplyStatus } from './ReplyStatus'
import { retainedReplyText, turnActivity } from '../../../domain/conversation/activity-summary'
import { useReplyStream } from '../../../state/session/attempt-streams'
import { TranslationStatus, translationPending } from '../../../components/reading/TranslationStatus'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { createMessageEvidenceSelector, evidenceStyle } from '../../../domain/learning/evidence/message-evidence'
import { memo, useContext, useEffect, useMemo, useState } from 'react'
import { MessageFeedback } from '../coaching/MessageFeedback'
import { PersonaReaction } from '../partners/PersonaReaction'
import type { GuidedTurnResult } from '../../../types'
import type { CoachControl, CoachDecision, CoachObservationView } from '../../../generated/contracts'

export interface TurnShape {
  replyState?: import('../../../domain/conversation/reply-state').ReplyState
  execution?: import('../../../generated/contracts').TurnView
  turnId?: string
  replacedBy?: string | null
  userSavedGloss?: import('../../../generated/contracts').WordGlossView | null
  userGlossOperationId?: string | null
  userTranslation?: string | null
  userTranslationState?: string | null
  userGlossState?: string | null
  userGlossError?: string | null

  id: number
  user: string | null
  assistant: GuidedTurnResult | null
  pendingText: string
  coach?: CoachObservationView
  conversationFeedback?: import('../../../generated/contracts').ConversationFeedback
  coachDecision?: CoachDecision
  coachError?: string
  reaction?: import('../../../types').PersonaReaction
  reactionError?: string
}

export interface TurnViewProps {
  turn: TurnShape
  reviewing: boolean
  onOpenCoach?: (id: number) => void
  onAskCoach: (question: string) => void
  focused: boolean
  ttsReady: boolean
  speaking: boolean
  speechError?: { text: string; details: unknown }
  rtl: boolean
  onBubbleTap: (id: number) => void
  onSpeak?: (text: string, turnId: number) => void
  /** Present only on the learner message sent from the latest recording. */
  onInspectRecording?: () => void
  /// Edit this turn's message and try again — the tutor (and coach) regenerate
  /// their response from the edited text. Omitted while a turn is in flight.
  onReplyControl?: (control: 'retry' | 'resume') => Promise<void>
  onActivity?: () => void
  onRetryHelp?: () => Promise<void>
  onRetryGloss?: (operationId: string) => Promise<void>
  onCoachControl?: (turn: TurnShape, control: CoachControl) => Promise<void>
  editDisabled?: boolean
  onEditUser?: (turn: TurnShape) => void
}

/// Memoized: during streaming, every delta re-renders only the turn that
/// changed — not the whole conversation.
export const TurnView = memo(function TurnView({
  turn,
  reviewing,
  onAskCoach,
  onOpenCoach,
  focused,
  ttsReady,
  speaking,
  speechError,
  rtl,
  onBubbleTap,
  onSpeak,
  onInspectRecording,
  onEditUser,
  onCoachControl,
  editDisabled,
  onRetryGloss,
  onRetryHelp,
  onReplyControl,
  onActivity,
}: TurnViewProps) {
  const tr = useI18n()
  const uiDirection = useUiDirection()
  const replyStream = useReplyStream(turn.execution)
  const activity = useMemo(() => turn.execution ? turnActivity(turn.execution, replyStream?.text ?? null) : null, [turn.execution, replyStream])
  const { autoTranslate, alwaysRomanize, alwaysPronunciation } = useReadingPreferences()
  const aidsEnabled = autoTranslate || alwaysRomanize || alwaysPronunciation
  const [userWordsOverride, setUserWordsOverride] = useState<boolean | null>(null)
  const userWordsOpen = userWordsOverride ?? aidsEnabled
  useEffect(() => { setUserWordsOverride(null) }, [autoTranslate, alwaysRomanize, alwaysPronunciation])
  const { snapshot } = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const selectEvidence = useMemo(createMessageEvidenceSelector, [])
  const evidence = selectEvidence(snapshot, practice?.chatId ?? null, turn.id, turn.user ?? '')
  const [userTranslationOverride, setShowUserTranslation] = useState<boolean | null>(null)
  const showUserTranslation = userTranslationOverride ?? autoTranslate
  const source = turn.user ?? ''
  const boundaries = [...new Set([0, source.length, ...evidence.flatMap(item => [item.start, item.end])])].sort((a, b) => a - b)
  const plainEvidence = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]
    const matches = evidence.filter(item => item.start < end && item.end > start)
    const text = source.slice(start, end)
    return matches.length ? <span key={start} className="message-evidence evidence-phrase" style={evidenceStyle(matches)} data-reward-evidence={JSON.stringify([...new Set(matches.map(item => item.id))])}><TargetText text={text} /></span> : <TargetText key={start} text={text} />
  })
  const assistant = turn.assistant
  const userTranslation = turn.userTranslation ?? assistant?.user_translation

  const userSegments = turn.userSavedGloss?.segments ?? (turn.user && assistant ? anchoredTokenGlosses(turn.user, assistant.user_tokens) : [])
  // Meanings set to show that may still arrive keep their line pitch reserved.
  const userAidsReserved = userWordsOpen && userSegments.length === 0 && !['failed', 'unknown', 'held', 'cancelled', 'invalidated'].includes(turn.userGlossState ?? '')
  const decorateEvidence = (node: React.ReactNode, start: number, end: number) => {
    const matches = evidence.filter(item => item.start < end && item.end > start)
    return matches.length ? <span className="message-evidence token-evidence" style={evidenceStyle(matches)} data-reward-evidence={JSON.stringify(matches.map(item => item.id))}>{node}</span> : node
  }

  return (
    <div className="turn-stack">
      {turn.user && (
        <div
          data-reward-message={turn.id}
          className={`msg chat-message me${userSegments.length ? '' : ' plain'}${userAidsReserved ? ' aids-reserved' : ''}${rtl ? ' rtl' : ''} with-actions`}
        >
          {userSegments.length > 0
            ? <SavedGlossText revealAids={userWordsOverride === true} showAids={userWordsOpen} key={turn.userSavedGloss?.attemptId ?? 'tokens'} text={turn.user} segments={userSegments} decorateSegment={decorateEvidence} />
            : plainEvidence}
          {showUserTranslation && userTranslation && <div className="trans" dir="auto">{userTranslation}</div>}
          <TranslationStatus state={turn.userTranslationState} shown={showUserTranslation && !userTranslation} />
          <GlossAssistance assistant={{ savedGloss: turn.userSavedGloss, glossState: turn.userGlossState, glossError: turn.userGlossError, glossOperationId: turn.userGlossOperationId }} onRetryGloss={onRetryGloss} />
          <EvidenceMappingNotice snapshot={snapshot} chatId={practice?.chatId ?? null} messageId={turn.id} />
          <div className="message-xp-actions" onDoubleClick={event => event.stopPropagation()}>
          {onEditUser && (
            <button
              type="button"
              className="message-translate edit-btn"
              onDoubleClick={event => event.stopPropagation()}
              disabled={editDisabled}
              title={tr("Edit message")}
              aria-label={tr("Edit message")}
              onClick={(e) => {
                e.stopPropagation()
                onEditUser(turn)
              }}
            >
              <span aria-hidden="true">✏️</span>
            </button>
          )}
          {onInspectRecording && <button type="button" className="message-translate recording-inspect" title={tr("Inspect recording")} aria-label={tr("Inspect recording")} aria-haspopup="dialog" onClick={event => { event.stopPropagation(); onInspectRecording() }}><ToolbarIcon name="mic" size={15} /></button>}
          <MessageXpButton messageId={turn.id} source={turn.user} />
          </div>
        <div dir={uiDirection} className={`message-feedback${turn.conversationFeedback ? ' has-scores' : ''}`} onDoubleClick={event => event.stopPropagation()}>
          <MessageFeedback conversationFeedback={turn.conversationFeedback} onOpenCoach={onOpenCoach ? () => onOpenCoach(turn.id) : undefined} onRetry={onRetryHelp} analysis={<AnalysisSentence label={tr("Your message")} text={turn.user} translation={userTranslation} gloss={turn.userSavedGloss} tokens={assistant?.user_tokens} />} id={turn.id} text={turn.user} feedback={turn.coach} decision={turn.coachDecision} onControl={onCoachControl ? control => onCoachControl(turn, control) : undefined} error={turn.coachError} reviewing={reviewing} onEdit={!editDisabled && onEditUser ? () => onEditUser(turn) : undefined} onAsk={onAskCoach}>
            {(userTranslation || translationPending(turn.userTranslationState)) && <button type="button" className={translationPending(turn.userTranslationState) ? 'message-translate is-hydrating' : 'message-translate'} aria-label={tr("Translate your message")} aria-expanded={showUserTranslation} aria-pressed={showUserTranslation} onClick={event => { event.stopPropagation(); setShowUserTranslation(!(showUserTranslation)) }}>{tr("Translate")}</button>}
            <button type="button" className={turn.userGlossState === 'running' ? 'message-translate is-hydrating' : 'message-translate'} disabled={!userSegments.length} aria-pressed={userWordsOpen} onClick={() => setUserWordsOverride(!userWordsOpen)}>{tr("Word by word")}</button>
            <AddToDrillButton key={turn.user} text={turn.user} />
          </MessageFeedback>
        </div>
        </div>
      )}
      {assistant && (
        <div className="partner-turn">
          <TargetMessage
            layout="bubble"
            text={assistant.reply}
            extraActions={<AddToDrillButton key={assistant.reply} text={assistant.reply} />}
            segments={assistant.savedGloss?.segments ?? anchoredTokenGlosses(assistant.reply, assistant.tokens)}
            segmentsKey={assistant.savedGloss ? `${assistant.savedGloss.operationId}:${assistant.savedGloss.attemptId}` : 'tokens'}
            segmentsPending={assistant.glossState === 'running'}
            lookupWords={false}
            translation={assistant.translation}
            translateLabel={tr("Translate persona message")}
            romanization={null}
            pronunciation={null}
            annotation={turn.user && <PersonaReaction userGloss={turn.userSavedGloss} replyGloss={assistant.savedGloss} reaction={turn.reaction} error={turn.reactionError} message={turn.user} reply={assistant.reply} onEdit={!editDisabled && onEditUser ? () => onEditUser(turn) : undefined} />}
            translationState={assistant.translationState}
            status={<GlossAssistance assistant={assistant} onRetryGloss={onRetryGloss} />}
            speech={ttsReady && onSpeak ? { speaking, onToggle: () => onSpeak(assistant.reply, turn.id), error: speechError ?? null } : null}
            analysis={{ pending: assistant.explanationsState === 'running', onOpen: () => onBubbleTap(turn.id) }}
            focused={focused}
            rtl={rtl}
          />
        </div>
      )}
      {assistant === null && (
        <ReplyStatus reply={turn.replyState} activity={activity} stream={replyStream} retainedText={retainedReplyText(turn.execution)} rtl={rtl} onControl={onReplyControl} onActivity={onActivity} />
      )}
    </div>
  )
})
