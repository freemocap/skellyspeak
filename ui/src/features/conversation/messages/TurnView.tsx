import { MessageXpButton } from '../progress/MessageXpButton'
import { ResponseDetails } from '../../../components/feedback/ResponseDetails'
import { requiresWholeWordShaping } from '../../../domain/language/script-text'
import { useUiDirection } from '../../../components/localization/useUiDirection'
import { useI18n } from '../../../components/localization/i18n'
import { AnalysisSentence } from '../reading/AnalysisSentence'
import { anchoredTokenGlosses } from '../../../domain/reading/gloss-display'
import { EvidenceMappingNotice } from '../../../components/learning/EvidenceMappingNotice'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { GlossAssistance } from '../reading/GlossAssistance'
import { SavedGlossText } from '../reading/SavedGlossText'
import { TargetText } from '../../../components/reading/TargetText'
import { TokenSpan } from '../../../components/reading/TokenSpan'
import { ReplyStatus } from './ReplyStatus'
import { TurnActivityLine } from './TurnActivityLine'
import { retainedReplyText, turnActivity } from '../../../domain/conversation/activity-summary'
import { useReplyStream } from '../../../state/session/attempt-streams'
import { TranslationStatus } from './TranslationStatus'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { createMessageEvidenceSelector, evidenceStyle } from '../../../domain/learning/evidence/message-evidence'
import { Fragment, memo, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { MessageFeedback } from '../coaching/MessageFeedback'
import { PersonaReaction } from '../partners/PersonaReaction'
import type { GuidedToken, GuidedTurnResult } from '../../../types'
import type { CoachControl, CoachDecision, CoachObservationView } from '../../../generated/contracts'
import { popupAnchor, type PopupState } from '../reading/GlossPopup'
import { groupSentences, splitSentences } from '../../../domain/reading/sentences'
import { sourceToken } from '../../../domain/reading/source-token'

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

/// One token entry: the token plus which sentence it belongs to (for
/// punctuation-tap sentence reveal).
interface TokenEntry {
  tok: GuidedToken
  si: number
}

function tokenEntries(tokens: GuidedToken[]): TokenEntry[] {
  return groupSentences(tokens).flatMap((sentence, si) =>
    sentence.map((tok) => ({ tok, si }))
  )
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
  revealed: Set<string>
  showRomanization: boolean
  alwaysRomanize: boolean
  alwaysPronunciation: boolean
  autoTranslate: boolean
  rtl: boolean
  onReveal: (keys: string[]) => void
  onBubbleTap: (id: number) => void
  onSpeak?: (text: string, turnId: number) => void
  onPopup: React.Dispatch<React.SetStateAction<PopupState | null>>
  onInspect: (turnId: number, side: 'me' | 'bot', index: number) => void
  onHold?: (word: string, sentence: string) => void
  onToggleReveal: (keys: string[]) => void
  /// Edit this turn's message and try again — the tutor (and coach) regenerate
  /// their response from the edited text. Omitted while a turn is in flight.
  onReplyControl?: (control: 'retry' | 'resume') => Promise<void>
  onActivity?: () => void
  onRetryHelp?: () => Promise<void>
  onRetryGloss?: (operationId: string) => Promise<void>
  onCoachControl?: (turn: TurnShape, control: CoachControl) => Promise<void>
  editDisabled?: boolean
  onEditUser?: (turn: TurnShape) => void
  /// The newest exchange: its live activity line shows even while only waiting.
  latest?: boolean
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
  revealed,
  showRomanization,
  alwaysRomanize,
  autoTranslate,
  alwaysPronunciation,
  rtl,
  onReveal,
  onBubbleTap,
  onSpeak,
  onPopup,
  onInspect,
  onHold,
  onToggleReveal,
  onEditUser,
  onCoachControl,
  editDisabled,
  onRetryGloss,
  onRetryHelp,
  onReplyControl,
  onActivity,
  latest = false,
}: TurnViewProps) {
  const tr = useI18n()
  const uiDirection = useUiDirection()
  const replyStream = useReplyStream(turn.execution)
  const activity = useMemo(() => turn.execution ? turnActivity(turn.execution, replyStream?.text ?? null) : null, [turn.execution, replyStream])
  const [savedWordsOverride, setSavedWordsOverride] = useState<boolean | null>(null)
  const aidsEnabled = autoTranslate || alwaysRomanize && showRomanization || alwaysPronunciation
  const savedWordsOpen = savedWordsOverride ?? aidsEnabled
  const [userWordsOverride, setUserWordsOverride] = useState<boolean | null>(null)
  const userWordsOpen = userWordsOverride ?? aidsEnabled
  useEffect(() => { setSavedWordsOverride(null); setUserWordsOverride(null) }, [autoTranslate, alwaysRomanize, alwaysPronunciation, showRomanization])
  const { snapshot } = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const selectEvidence = useMemo(createMessageEvidenceSelector, [])
  const evidence = selectEvidence(snapshot, practice?.chatId ?? null, turn.id, turn.user ?? '')
  const [userTranslationOverride, setShowUserTranslation] = useState<boolean | null>(null)
  const showUserTranslation = userTranslationOverride ?? autoTranslate
  const [personaTranslationOverride, setShowPersonaTranslation] = useState<boolean | null>(null)
  const showPersonaTranslation = personaTranslationOverride ?? autoTranslate
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

  const dragRef = useRef({ active: false, start: -1, last: -1, moved: false, side: null as 'me' | 'bot' | null, turnId: null as number | null })

  const replyEntries = useMemo(
    () => (assistant && assistant.tokens.length > 0 ? tokenEntries(assistant.tokens) : []),
    [assistant]
  )
  const userEntries = useMemo(
    () =>
      assistant && assistant.user_tokens && assistant.user_tokens.length > 0
        ? tokenEntries(assistant.user_tokens)
        : [],
    [assistant]
  )

  const beginDrag = (turnId: number, side: 'me' | 'bot', gi: number) => {
    dragRef.current = { active: true, start: gi, last: gi, moved: false, side, turnId }
    const up = () => {
      // Drag ending: the drag-start word gets its gloss revealed too.
      const d = dragRef.current
      if (d.moved && d.start >= 0) onReveal([`${turnId}:${side}:${d.start}`])
      d.active = false
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mouseup', up)
  }
  const dragOver = (turnId: number, side: 'me' | 'bot', gi: number) => {
    const d = dragRef.current
    if (!d.active || d.side !== side || d.turnId !== turnId || gi === d.last) return
    d.last = gi
    d.moved = true
    onReveal([`${turnId}:${side}:${gi}`])
  }

  const tokenTap = (
    tok: GuidedToken,
    si: number,
    translation: string | null,
    e: React.MouseEvent<HTMLSpanElement>,
    actions: PopupState['actions']
  ) => {
    if (dragRef.current.moved) return // drag ended on this span — no popup
    const pos = popupAnchor(e.currentTarget)
    const show = (text: string) =>
      onPopup((prev) =>
        prev && prev.text === text ? null : { text, romanization: tok.romanization, actions, ...pos }
      )
    if (tok.gloss) {
      show(tok.gloss)
      return
    }
    // Punctuation token: reveal that sentence's translation.
    if (!translation) return
    const parts = splitSentences(translation)
    show(parts[si] ?? translation)
  }
  const bubbleTap = () => onBubbleTap(turn.id)

  const renderTokens = (
    entries: TokenEntry[],
    turnId: number,
    side: 'me' | 'bot',
    translation: string | null,
    rawText: string
  ) => {
    if (requiresWholeWordShaping(rawText)) return <SavedGlossText revealAids={(side === 'me' ? userWordsOverride : savedWordsOverride) === true} showAids={side === 'me' ? userWordsOpen : savedWordsOpen} text={rawText} segments={anchoredTokenGlosses(rawText, entries.map(entry => entry.tok))}
      decorateSegment={(node, start, end) => {
        const matches = side === 'me' ? evidence.filter(item => item.start < end && item.end > start) : []
        return matches.length ? <span className="message-evidence token-evidence" style={evidenceStyle(matches)} data-reward-evidence={JSON.stringify(matches.map(item => item.id))}>{node}</span> : node
      }} />
    let cursor = 0
    return (
    <span className={rtl ? 'line rtl-line' : 'line'}>
      {entries.map(({ tok: annotation, si }, gi) => {
        const match = sourceToken(rawText, annotation.text, cursor)
        if (!match) return null
        const { start, end } = match
        const prefix = rawText.slice(cursor, start)
        const tok = { ...annotation, text: match.text }
        cursor = end
        const matches = side === 'me' && start >= 0 ? evidence.filter(item => item.start < cursor && item.end > start) : []
        const key = `${turnId}:${side}:${gi}`
        const isRevealed = revealed.has(key)
        return (
          <Fragment key={`${side}-${gi}`}>
            <TargetText text={prefix} />
          <span className={matches.length ? 'message-evidence token-evidence' : undefined} data-reward-evidence={matches.length ? JSON.stringify([...new Set(matches.map(item => item.id))]) : undefined}>
          <TokenSpan
            key={`${side}-${gi}`}
            tok={tok} sourceText={rawText} sourceStart={start}
            textStyle={evidenceStyle(matches)}
            revealed={isRevealed}
            hasTranslation={!!translation}
            showAids={side === 'me' ? userWordsOpen : savedWordsOpen}
            showTranslation={autoTranslate || (side === 'me' ? userWordsOverride : savedWordsOverride) === true}
            showRomanization={showRomanization}
            alwaysRomanize={alwaysRomanize || (side === 'me' ? userWordsOverride : savedWordsOverride) === true}
            alwaysPronunciation={alwaysPronunciation || (side === 'me' ? userWordsOverride : savedWordsOverride) === true}
            onTap={(e) => {
              e.stopPropagation()
              if (dragRef.current.moved) return
              if (tok.gloss || tok.pronunciation || tok.romanization) {
                onPopup(null)
                onToggleReveal([key])
              } else tokenTap(tok, si, translation, e, [])
            }}
            onDragStart={() => beginDrag(turnId, side, gi)}
            onDragOver={() => dragOver(turnId, side, gi)}
            onInspect={(e) => {
              e.preventDefault()
              onInspect(turnId, side, gi)
            }}
            onHold={onHold ? () => {
              const sents = splitSentences(rawText)
              onHold(tok.text, sents[si] ?? rawText)
            } : undefined}
          />
          </span>
          </Fragment>
        )
      })}
      <TargetText text={rawText.slice(cursor)} />
    </span>
  )
  }

  return (
    <div className="turn-stack">
      {turn.user && (
        <div
          data-reward-message={turn.id}
          className={`msg chat-message me${userEntries.length ? '' : ' plain'}${rtl ? ' rtl' : ''}${turn.conversationFeedback ? ' with-scores' : ''} with-actions`}
          onDoubleClick={() =>
            assistant && onToggleReveal(assistant.user_tokens.map((_, i) => `${turn.id}:me:${i}`))
          }
        >
          {turn.userSavedGloss
            ? <SavedGlossText revealAids={userWordsOverride === true} showAids={userWordsOpen} key={turn.userSavedGloss.attemptId} text={turn.user} segments={turn.userSavedGloss.segments} decorateSegment={(node, start, end) => {
                const matches = evidence.filter(item => item.start < end && item.end > start)
                return matches.length ? <span className="message-evidence token-evidence" style={evidenceStyle(matches)} data-reward-evidence={JSON.stringify(matches.map(item => item.id))}>{node}</span> : node
              }} />
            : userEntries.length > 0
            ? renderTokens(userEntries, turn.id, 'me', assistant?.user_translation ?? null, turn.user ?? '')
            : plainEvidence}
          {showUserTranslation && userTranslation && <div className="trans" dir="auto">{userTranslation}</div>}
          <TranslationStatus state={turn.userTranslationState} />
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
          <MessageXpButton messageId={turn.id} source={turn.user} />
          </div>
        <div dir={uiDirection} className={`message-feedback${turn.conversationFeedback ? ' has-scores' : ''}`} onDoubleClick={event => event.stopPropagation()}>
          <MessageFeedback conversationFeedback={turn.conversationFeedback} onOpenCoach={onOpenCoach ? () => onOpenCoach(turn.id) : undefined} onRetry={onRetryHelp} analysis={<AnalysisSentence label={tr("Your message")} text={turn.user} translation={userTranslation} gloss={turn.userSavedGloss} tokens={assistant?.user_tokens} />} id={turn.id} text={turn.user} feedback={turn.coach} decision={turn.coachDecision} onControl={onCoachControl ? control => onCoachControl(turn, control) : undefined} error={turn.coachError} reviewing={reviewing} onEdit={!editDisabled && onEditUser ? () => onEditUser(turn) : undefined} onAsk={onAskCoach}>
            {userTranslation && <button type="button" className="message-translate" aria-label={tr("Translate your message")} aria-expanded={showUserTranslation} aria-pressed={showUserTranslation} onClick={event => { event.stopPropagation(); setShowUserTranslation(!(showUserTranslation)) }}>{tr("Translate")}</button>}
            <button type="button" className={turn.userGlossState === 'running' ? 'message-translate is-hydrating' : 'message-translate'} disabled={!turn.userSavedGloss && !userEntries.length} aria-pressed={userWordsOpen} onClick={() => setUserWordsOverride(!userWordsOpen)}>{tr("Word by word")}</button>
          </MessageFeedback>
        </div>
        </div>
      )}
      {assistant && (
        <div className="partner-turn">
        <div
          onDoubleClick={() =>
            assistant && onToggleReveal(assistant.tokens.map((_, i) => `${turn.id}:bot:${i}`))
          }
          className={`msg chat-message bot with-actions ${focused ? 'focused' : ''}${rtl ? ' rtl' : ''}${ttsReady && onSpeak ? ' with-corner-control' : ''}`}
        >
          {assistant.savedGloss ? (
            <SavedGlossText revealAids={savedWordsOverride === true} showAids={savedWordsOpen} key={`${assistant.savedGloss.operationId}:${assistant.savedGloss.attemptId}`} text={assistant.reply} segments={assistant.savedGloss.segments} />
          ) : assistant.tokens.length > 0 ? (
            renderTokens(
              replyEntries,
              turn.id,
              'bot',
              assistant.translation,
              assistant.reply
            )
          ) : (
            <TargetText text={assistant.reply} />
          )}
          {turn.user && <PersonaReaction userGloss={turn.userSavedGloss} replyGloss={assistant.savedGloss} reaction={turn.reaction} error={turn.reactionError} message={turn.user} reply={assistant.reply} onEdit={!editDisabled && onEditUser ? () => onEditUser(turn) : undefined} />}
          {(showPersonaTranslation) && assistant.translation && (
            <div className="trans" dir="auto">{assistant.translation}</div>
          )}
          <TranslationStatus state={assistant.translationState} />
          <GlossAssistance assistant={assistant} onRetryGloss={onRetryGloss} />
          {ttsReady && onSpeak && <button type="button" className="bubble-corner-control speak-btn" title={speaking ? tr("Stop playback") : tr("Speak reply")} aria-label={speaking ? tr("Stop playback") : tr("Speak reply")} onDoubleClick={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onSpeak(assistant.reply, turn.id) }}><span aria-hidden="true">{speaking ? '⏹' : '🔊'}</span></button>}
          {speechError && <ErrorDetails label={tr("Speech")} errorKey={speechError.text} explanation={speechError.text}><ResponseDetails value={speechError.details} /></ErrorDetails>}
          <div className="message-actions" dir={uiDirection} onDoubleClick={event => event.stopPropagation()}>
          {assistant.translation && <button type="button" className="message-translate" aria-label={tr("Translate persona message")} aria-expanded={showPersonaTranslation} aria-pressed={showPersonaTranslation} onKeyDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setShowPersonaTranslation(!(showPersonaTranslation)) }}>{tr("Translate")}</button>}
          <button type="button" className={assistant.glossState === 'running' ? 'message-translate is-hydrating' : 'message-translate'} disabled={!assistant.savedGloss && !assistant.tokens.length} aria-pressed={savedWordsOpen} onClick={() => setSavedWordsOverride(!savedWordsOpen)}>{tr("Word by word")}</button>
          <button type="button" className={assistant.explanationsState === 'running' ? 'message-translate is-hydrating' : 'message-translate'} aria-haspopup="dialog" onClick={bubbleTap}>{tr("Analysis")}</button>
          </div>
        </div>
        </div>
      )}
      {assistant === null && (
        <ReplyStatus reply={turn.replyState} activity={activity} stream={replyStream} retainedText={retainedReplyText(turn.execution)} rtl={rtl} onControl={onReplyControl} onActivity={onActivity} />
      )}
      {assistant !== null && activity && (latest || activity.running.length > 0) && (
        <TurnActivityLine activity={activity} onActivity={onActivity} />
      )}
    </div>
  )
})
