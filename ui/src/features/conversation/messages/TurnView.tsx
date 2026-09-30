import { bubbleSelection } from '../../../components/reading/bubble-selection'
import { SelectionRing } from '../../../components/reading/SelectionRing'
import { MessageSkillAnalysis } from '../reading/MessageSkillAnalysis'
import { AddToDrillButton } from '../../../components/reading/AddToDrillButton'
import { MessageTools, type MessageTool } from '../../../components/reading/MessageTools'
import { useReadAloud } from '../../../components/reading/useReadAloud'
import { MessageSpeechInspection, type MessageSpeechPlayback } from '../speech/MessageSpeechInspection'
import { CompactInspection } from '../../../components/media/CompactInspection'
import { useRecordingPlayback } from '../../../components/media/useRecordingPlayback'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { MessageXpButton } from '../progress/MessageXpButton'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useI18n } from '../../../components/localization/i18n'
import { AnalysisSentence } from '../reading/AnalysisSentence'
import { anchoredTokenGlosses } from '../../../domain/reading/gloss-display'
import { EvidenceMappingNotice } from '../../../components/learning/EvidenceMappingNotice'
import { GlossAssistance } from '../reading/GlossAssistance'
import { SavedGlossText } from '../../../components/reading/SavedGlossText'
import { TargetMessage } from '../../../components/reading/TargetMessage'
import { useReadingAidSpace, useReadingPreferences } from '../../../components/reading/ReadingPreferences'
import { TargetText } from '../../../components/reading/TargetText'
import { ReplyStatus } from './ReplyStatus'
import { ReceivedText } from './PendingBubble'
import { useReplyReveal } from './useReplyReveal'
import { StableTurn } from './StableTurn'
import { PendingLearner, WAITING_REPLY } from './PendingTurn'
import type { PendingMessage } from '../session/usePendingMessage'
import { retainedReplyText } from '../../../domain/conversation/activity-summary'
import { useReplyStream } from '../../../state/session/attempt-streams'
import { TranslationStatus, translationPending } from '../../../components/reading/TranslationStatus'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { coachFlags, coachMarks } from '../../../domain/conversation/coach-marks'
import { memo, useContext, useEffect, useRef, useState } from 'react'
import { MessageFeedback } from '../coaching/MessageFeedback'
import { PersonaReaction } from '../partners/PersonaReaction'
import type { GuidedTurnResult } from '../../../types'
import type { CoachControl, CoachDecision, CoachObservationView } from '../../../generated/contracts'

export interface TurnShape {
  replyState?: import('../../../domain/conversation/reply-state').ReplyState
  execution?: import('../../../generated/contracts').TurnView
  turnId?: string
  replacesTurnId?: string | null
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
  feedbackContext?: string
  conversationFeedback?: import('../../../generated/contracts').ConversationFeedback
  coachDecision?: CoachDecision
  coachError?: string
  reaction?: import('../../../types').PersonaReaction
  reactionError?: string
}

export interface TurnRecording {
  result: import('../../../generated/contracts').TranscriptionInspectionResult
  rate: number
  volume: number
  enabled: boolean
  onExpand: () => void
}

export interface TurnViewProps {
  turn: TurnShape
  reviewing: boolean
  onAskCoach: (question: string) => void
  selectedSide?: 'user' | 'assistant'
  onSelectMessage?: (id: number, side: 'user' | 'assistant') => void
  focused: boolean
  ttsReady: boolean
  speaking: boolean
  speechError?: { text: string; details: unknown }
  partnerSpeech?: MessageSpeechPlayback
  rtl: boolean
  onBubbleTap: (id: number) => void
  onSpeak?: (text: string, turnId: number) => void
  /** Present only on the learner message sent from the latest recording: its
   *  audio and analysis, the playback settings, and the full dialog. */
  recording?: TurnRecording
  /// Edit this turn's message and try again — the tutor (and coach) regenerate
  /// their response from the edited text. Omitted while a turn is in flight.
  onReplyControl?: (control: 'retry' | 'resume') => Promise<void>
  onActivity?: () => void
  onAddContext?: (note: string) => Promise<void>
  onRetryHelp?: () => Promise<void>
  onRetryGloss?: (operationId: string) => Promise<void>
  onCoachControl?: (turn: TurnShape, control: CoachControl) => Promise<void>
  editDisabled?: boolean
  onEditUser?: (turn: TurnShape) => void
  /** This turn's message is open in the composer to be fixed and resent. */
  editing: boolean
  pendingEdit?: PendingMessage
}

/// Memoized: during streaming, every delta re-renders only the turn that
/// changed — not the whole conversation.
export const TurnView = memo(function TurnView(props: TurnViewProps) {
  return <StableTurn className="turn-stack" data-editing={props.editing ? '' : undefined} data-pending={props.pendingEdit?.phase}>
    <TurnContents key={props.turn.turnId ?? props.turn.id} {...props} />
  </StableTurn>
})

// Record-specific controls reset on revision; the presentation floor stays put.
function TurnContents({
  turn,
  reviewing,
  onAskCoach,
  focused, selectedSide, onSelectMessage,
  ttsReady,
  speaking,
  speechError,
  partnerSpeech,
  rtl,
  onBubbleTap,
  onSpeak,
  recording,
  onEditUser,
  editing,
  pendingEdit,
  onCoachControl,
  editDisabled,
  onRetryGloss,
  onRetryHelp,
  onAddContext,
  onReplyControl,
  onActivity,
}: TurnViewProps) {
  const tr = useI18n()
  const replyStream = useReplyStream(turn.execution)
  const arrivedPending = useRef(!turn.assistant)
  useEffect(() => { if (!turn.assistant || pendingEdit) arrivedPending.current = true }, [turn.assistant, pendingEdit])
  const replyText = turn.assistant?.reply || replyStream?.text || retainedReplyText(turn.execution) || ''
  const reveal = useReplyReveal(replyText, arrivedPending.current && (Boolean(turn.assistant) || turn.replyState?.state === 'pending'))

  const { autoTranslate, alwaysRomanize, alwaysPronunciation } = useReadingPreferences()
  // Your recording's inspector opens only when you ask for it.
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [partnerInspectorOpen, setPartnerInspectorOpen] = useState(false)
  const [recordingFailure, setRecordingFailure] = useState<unknown>(null)
  const recordingPlayback = useRecordingPlayback({ audio: recording?.result.audioBase64 || null, duration: recording?.result.inspection.duration ?? 0,
    enabled: recording?.enabled ?? false, rate: recording?.rate ?? 1, volume: recording?.volume ?? 1, onError: setRecordingFailure })
  const aidsEnabled = autoTranslate || alwaysRomanize || alwaysPronunciation
  const [userWordsOverride, setUserWordsOverride] = useState<boolean | null>(null)
  const userWordsOpen = userWordsOverride ?? aidsEnabled
  const aidSpace = useReadingAidSpace(userWordsOverride === true)
  useEffect(() => { setUserWordsOverride(null) }, [autoTranslate, alwaysRomanize, alwaysPronunciation])
  const { snapshot } = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const [userTranslationOverride, setShowUserTranslation] = useState<boolean | null>(null)
  const showUserTranslation = userTranslationOverride ?? autoTranslate
  const source = turn.user ?? ''
  // Phrases the coach flagged carry a squiggle: red for errors, yellow for partly right.
  const flags = coachFlags(turn.coach, turn.coachDecision)
  const marks = coachMarks(source, flags)
  const boundaries = [...new Set([0, source.length, ...marks.flatMap(mark => [mark.start, mark.end])])].sort((a, b) => a - b)
  const plainMarked = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]
    const mark = marks.find(item => item.start < end && item.end > start)
    const text = source.slice(start, end)
    return mark ? <span key={start} className="coach-flag" data-severity={mark.severity}><TargetText text={text} /></span> : <TargetText key={start} text={text} />
  })
  const assistant = turn.assistant
  const userTranslation = turn.userTranslation ?? assistant?.user_translation

  const userSegments = turn.userSavedGloss?.segments ?? (turn.user && assistant ? anchoredTokenGlosses(turn.user, assistant.user_tokens) : [])
  // Meanings set to show that may still arrive keep their line pitch reserved.
  const userAidsReserved = userWordsOpen && userSegments.length === 0 && !['failed', 'unknown', 'held', 'cancelled', 'invalidated'].includes(turn.userGlossState ?? '')
  const decorateMarks = (node: React.ReactNode, start: number, end: number) => {
    const mark = marks.find(item => item.start < end && item.end > start)
    return mark ? <span className="coach-flag" data-severity={mark.severity}>{node}</span> : node
  }

  const readAloud = useReadAloud(source)
  const inspectable = recording ?? null
  // A message you spoke plays your recording; a typed one is read aloud.
  const learnerPlay = inspectable
    ? { playing: recordingPlayback.playing, disabled: !inspectable.enabled || !inspectable.result.audioBase64, onToggle: recordingPlayback.toggle }
    : readAloud
  const learnerTools: MessageTool[] = userTranslation || translationPending(turn.userTranslationState)
    ? [{ key: 'translate', label: tr("Translate"), ariaLabel: tr("Translate your message"),
      pressed: showUserTranslation, pending: translationPending(turn.userTranslationState), onSelect: () => setShowUserTranslation(!showUserTranslation) }]
    : []
  const learnerMore = (analysisTool: MessageTool): MessageTool[] => [
    { key: 'words', label: tr("Word by word"), pressed: userWordsOpen, pending: turn.userGlossState === 'running', disabled: !userSegments.length,
      onSelect: () => setUserWordsOverride(!userWordsOpen) },
    analysisTool,
  ]

  return (
    <>
      {turn.user && (
        <div className="learner-turn">
          {editing && <span className="learner-turn-editing"><ToolbarIcon name="edit" size={12} />{tr("Fixing this message")}</span>}
          {!editing && turn.replacesTurnId && <span className="learner-turn-edited"><ToolbarIcon name="fixes" size={13} />{tr("Fixed")}</span>}
          {pendingEdit ? <PendingLearner message={pendingEdit} rtl={rtl} /> : <>
          <MessageFeedback onAddContext={onAddContext} feedbackContext={turn.feedbackContext} conversationFeedback={turn.conversationFeedback} onRetry={onRetryHelp} analysis={<AnalysisSentence label={tr("Your message")} text={turn.user} translation={userTranslation} gloss={turn.userSavedGloss} tokens={assistant?.user_tokens} />} skills={<MessageSkillAnalysis messageId={turn.id} source={turn.user} />} id={turn.id} text={turn.user} feedback={turn.coach} decision={turn.coachDecision} onControl={onCoachControl ? control => onCoachControl(turn, control) : undefined} error={turn.coachError} reviewing={reviewing} onEdit={!editDisabled && onEditUser ? () => onEditUser(turn) : undefined} onAsk={onAskCoach}
            reward={<MessageXpButton messageId={turn.id} source={turn.user} />}
            bubble={analysisTool => (
              <div
                {...bubbleSelection(onSelectMessage ? () => onSelectMessage(turn.id, 'user') : undefined, selectedSide === 'user', tr("Your message"))}
                className={`msg chat-message me${selectedSide === 'user' ? ' focused' : ''}${userSegments.length ? '' : ' plain'}${userAidsReserved ? ' aids-reserved' : ''}${rtl ? ' rtl' : ''}${inspectable && inspectorOpen ? ' inspecting' : ''} with-actions`}
                style={aidSpace}
              >
                {userSegments.length > 0
                  ? <SavedGlossText revealAids={userWordsOverride === true} showAids={userWordsOpen} key={turn.userSavedGloss?.attemptId ?? 'tokens'} text={turn.user!} segments={userSegments} decorateSegment={decorateMarks} />
                  : plainMarked}
                {showUserTranslation && userTranslation && <div className="trans" dir="auto">{userTranslation}</div>}
                <TranslationStatus state={turn.userTranslationState} shown={showUserTranslation && !userTranslation} />
                <GlossAssistance assistant={{ savedGloss: turn.userSavedGloss, glossState: turn.userGlossState, glossError: turn.userGlossError, glossOperationId: turn.userGlossOperationId }} onRetryGloss={onRetryGloss} />
                <EvidenceMappingNotice snapshot={snapshot} chatId={practice?.chatId ?? null} messageId={turn.id} />
                {inspectable && inspectorOpen && <CompactInspection inspection={inspectable.result.inspection} playback={recordingPlayback}
                  enabled={inspectable.enabled} onExpand={inspectable.onExpand} />}
                <MessageTools play={learnerPlay} tools={learnerTools} more={learnerMore(analysisTool)}
                  // BACKEND: only the latest recording is kept, in memory, so earlier messages have no audio to inspect (Deferred A16).
                  inspect={inspectable && { kind: 'available', open: inspectorOpen, onToggle: () => setInspectorOpen(!inspectorOpen) }}
                  actions={<>
                    {/* With errors flagged, Fix it under the bubble is the edit action. */}
                    {onEditUser && flags.length === 0 && <button type="button" className="message-tools-icon" disabled={editDisabled} aria-label={tr("Edit message")} title={tr("Edit message")}
                      onClick={event => { event.stopPropagation(); onEditUser(turn) }}><ToolbarIcon name="edit" /></button>}
                    <AddToDrillButton text={turn.user!} />
                  </>} />
                {recordingFailure != null && <ErrorNotice as="p" error={recordingFailure}>{tr("Audio playback failed.")}</ErrorNotice>}
                {(onSelectMessage || selectedSide === 'user') && <SelectionRing />}
              </div>
            )} />
          </>}
        </div>
      )}
      {assistant && !pendingEdit && (
        <div className="partner-turn">
          <span className="partner-reaction-slot">
            {turn.user && <PersonaReaction userGloss={turn.userSavedGloss} replyGloss={assistant.savedGloss} reaction={turn.reaction} error={turn.reactionError} message={turn.user} reply={assistant.reply} onEdit={!editDisabled && onEditUser ? () => onEditUser(turn) : undefined} />}
          </span>
          <TargetMessage provenance={null}
            layout="bubble"
            text={assistant.reply}
            sourcePresentation={reveal.revealing ? <ReceivedText text={assistant.reply} visibleText={reveal.text} streaming rtl={rtl} /> : undefined}
            segments={assistant.savedGloss?.segments ?? anchoredTokenGlosses(assistant.reply, assistant.tokens)}
            segmentsKey={assistant.savedGloss ? `${assistant.savedGloss.operationId}:${assistant.savedGloss.attemptId}` : 'tokens'}
            segmentsPending={['ready', 'waiting_dependencies', 'running'].includes(assistant.glossState ?? '')}
            lookupWords={false}
            translation={assistant.translation || null}
            translateLabel={tr("Translate partner message")}
            romanization={null}
            pronunciation={null}
            annotation={null}
            translationState={assistant.translationState}
            status={<GlossAssistance assistant={assistant} onRetryGloss={onRetryGloss} />}
            speech={ttsReady && onSpeak ? { speaking, preparing: partnerSpeech?.preparing, disabled: partnerSpeech && !partnerSpeech.enabled, onToggle: () => onSpeak(assistant.reply, turn.id), error: speechError ?? null } : null}
            analysis={{ pending: assistant.explanationsState === 'running', onOpen: () => onBubbleTap(turn.id) }}
            inspect={partnerSpeech ? { kind: 'available', open: partnerInspectorOpen, disabled: !partnerSpeech.enabled, onToggle: () => {
              setPartnerInspectorOpen(!partnerInspectorOpen)
              if (!partnerInspectorOpen && !partnerSpeech.retained && !partnerSpeech.playing && !partnerSpeech.preparing) partnerSpeech.toggle()
            } } : null}
            inspector={partnerSpeech && <MessageSpeechInspection open={partnerInspectorOpen} speech={partnerSpeech} text={assistant.reply} />}
            onSelect={onSelectMessage ? () => onSelectMessage(turn.id, 'assistant') : undefined}
            focused={selectedSide === 'assistant' || (!onSelectMessage && focused)}
            rtl={rtl}
          />
        </div>
      )}
      {pendingEdit ? (
        pendingEdit.phase === 'sending' && <ReplyStatus reply={WAITING_REPLY} rtl={rtl} />
      ) : assistant === null && (
        <ReplyStatus reply={turn.replyState} stream={replyStream} visibleText={reveal.text} retainedText={retainedReplyText(turn.execution)} rtl={rtl} onControl={onReplyControl} onActivity={onActivity} />
      )}
    </>
  )
}
