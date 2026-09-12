import { ErrorDetails } from '../../ui/ErrorDetails'
import { GlossAssistance } from './GlossAssistance'
import { SavedGlossText } from './SavedGlossText'
import { TargetText } from '../../ui/TargetText'
import { TokenSpan } from '../../ui/TokenSpan'
import { RewardInspectionContext } from './RewardInspectionContext'
import { InlineXpBadge } from './InlineXpBadge'
import { ActivityIndicator } from '../../ui/ActivityIndicator'
import { SkillEvidenceContext } from '../../state/useSkillEvidence'
import { PracticeContext } from './PracticeContext'
import { createMessageEvidenceSelector, evidenceStyle, type MessageEvidence } from '../../domain/skills/message-evidence'
import { Fragment, memo, useContext, useMemo, useRef, useState } from 'react'
import { MessageFeedback } from './MessageFeedback'
import { PersonaReaction } from './PersonaReaction'
import type { GuidedToken, GuidedTurnResult } from '../../types'
import type { Feedback } from '../../contracts'
import { popupAnchor, type PopupState } from './GlossPopup'
import { groupSentences, splitSentences } from '../../domain/language/sentences'
import { sourceToken } from '../../domain/language/source-token'

export interface TurnShape {
  userSavedGloss?: import('../../contracts').WordGlossView | null
  userGlossOperationId?: string | null
  userTranslation?: string | null
  userGlossState?: string | null
  userGlossError?: string | null

  id: number
  user: string | null
  assistant: GuidedTurnResult | null
  pendingText: string
  coach?: Feedback
  coachError?: string
  reaction?: import('../../types').PersonaReaction
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
  onAskCoach: (question: string) => void
  focused: boolean
  ttsReady: boolean
  speaking: boolean
  speechError?: string
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
  onRetryGloss?: (operationId: string) => Promise<void>
  onEditUser?: (turn: TurnShape) => void
}

/// Memoized: during streaming, every delta re-renders only the turn that
/// changed — not the whole conversation.
export const TurnView = memo(function TurnView({
  turn,
  reviewing,
  onAskCoach,
  focused,
  ttsReady,
  speaking,
  speechError,
  revealed,
  showRomanization,
  alwaysRomanize,
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
  onRetryGloss,
}: TurnViewProps) {
  const { snapshot } = useContext(SkillEvidenceContext)
  const practice = useContext(PracticeContext)
  const selectEvidence = useMemo(createMessageEvidenceSelector, [])
  const evidence = selectEvidence(snapshot, practice?.chatId ?? null, turn.id, turn.user ?? '')
  const inspection = useContext(RewardInspectionContext)
  const setRewardDetail = (items: MessageEvidence[]): void => {
    if (!inspection) throw new Error('XP inspection provider is missing')
    inspection.open(items, turn.id, turn.user ?? '')
  }
  const [showUserTranslation, setShowUserTranslation] = useState(false)
  const [showPersonaTranslation, setShowPersonaTranslation] = useState(false)
  const creditMarkers = (items: MessageEvidence[]) => [...new Map(items.map(item => [item.id, item])).values()].map(item => <InlineXpBadge key={item.id} item={item} generation={0} onOpen={() => setRewardDetail([item])} />)
  const source = turn.user ?? ''
  const boundaries = [...new Set([0, source.length, ...evidence.flatMap(item => [item.start, item.end])])].sort((a, b) => a - b)
  const plainEvidence = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]
    const matches = evidence.filter(item => item.start < end && item.end > start)
    const text = source.slice(start, end)
    return matches.length ? <Fragment key={start}><button className="message-evidence evidence-phrase" style={evidenceStyle(matches)} data-reward-evidence={JSON.stringify([...new Set(matches.map(item => item.id))])} onClick={event => { event.stopPropagation(); setRewardDetail(matches) }}>{text}</button>{creditMarkers(matches.filter(item => item.end === end))}</Fragment> : <TargetText key={start} text={text} />
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
        const endingCredits = matches.filter(item => item.end <= cursor)
        const key = `${turnId}:${side}:${gi}`
        const isRevealed = revealed.has(key)
        return (
          <Fragment key={`${side}-${gi}`}>
            {prefix}
          <span className={matches.length ? 'message-evidence token-evidence' : undefined} data-reward-evidence={matches.length ? JSON.stringify([...new Set(matches.map(item => item.id))]) : undefined}>
          <TokenSpan
            key={`${side}-${gi}`}
            tok={tok}
            textStyle={evidenceStyle(matches)}
            revealed={isRevealed}
            hasTranslation={!!translation}
            showRomanization={showRomanization}
            alwaysRomanize={alwaysRomanize}
            alwaysPronunciation={alwaysPronunciation}
            onTap={(e) => {
              e.stopPropagation()
              if (dragRef.current.moved) return
              if (matches.length) setRewardDetail(matches)
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
          {creditMarkers(endingCredits)}
          </Fragment>
        )
      })}
      {rawText.slice(cursor)}
    </span>
  )
  }

  return (
    <div className="turn-stack">
      {turn.user && (
        <div
          data-reward-message={turn.id}
          className={`msg me${userEntries.length ? '' : ' plain'}${rtl ? ' rtl' : ''}${onEditUser ? ' with-edit' : ''} with-actions`}
          onDoubleClick={() =>
            assistant && onToggleReveal(assistant.user_tokens.map((_, i) => `${turn.id}:me:${i}`))
          }
        >
          {turn.userSavedGloss
            ? <SavedGlossText key={turn.userSavedGloss.attemptId} text={turn.user} segments={turn.userSavedGloss.segments} decorateSegment={(node, start, end) => {
                const matches = evidence.filter(item => item.start < end && item.end > start)
                return matches.length ? <span className="message-evidence token-evidence" style={evidenceStyle(matches)} data-reward-evidence={JSON.stringify(matches.map(item => item.id))}>{node}</span> : node
              }} afterSegment={(start, end) => creditMarkers(evidence.filter(item => item.end > start && item.end <= end))} />
            : userEntries.length > 0
            ? renderTokens(userEntries, turn.id, 'me', assistant?.user_translation ?? null, turn.user ?? '')
            : plainEvidence}
          {showUserTranslation && userTranslation && <div className="trans" dir="auto">{userTranslation}</div>}
          <GlossAssistance assistant={{ savedGloss: turn.userSavedGloss, glossState: turn.userGlossState, glossError: turn.userGlossError, glossOperationId: turn.userGlossOperationId }} onRetryGloss={onRetryGloss} />
          <MessageFeedback id={turn.id} text={turn.user} feedback={turn.coach} error={turn.coachError} reviewing={reviewing} onEdit={onEditUser ? () => onEditUser(turn) : undefined} onAsk={onAskCoach}>
            {userTranslation && <button type="button" className="message-translate" aria-label="Translate your message" aria-expanded={showUserTranslation} onClick={event => { event.stopPropagation(); setShowUserTranslation(!(showUserTranslation)) }}>Translate</button>}
          </MessageFeedback>
          {onEditUser && (
            <button
              type="button"
              className="edit-btn"
              title="Edit this message and try again"
              aria-label="Edit this message and try again"
              onClick={(e) => {
                e.stopPropagation()
                onEditUser(turn)
              }}
            >
              ✎
            </button>
          )}
        </div>
      )}
      {assistant && (
        <div
          onDoubleClick={() =>
            assistant && onToggleReveal(assistant.tokens.map((_, i) => `${turn.id}:bot:${i}`))
          }
          className={`msg bot with-actions ${focused ? 'focused' : ''}${ttsReady ? ' with-speak' : ''}${rtl ? ' rtl' : ''}`}
        >
          {assistant.savedGloss ? (
            <SavedGlossText key={`${assistant.savedGloss.operationId}:${assistant.savedGloss.attemptId}`} text={assistant.reply} segments={assistant.savedGloss.segments} />
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
          {turn.user && <PersonaReaction reaction={turn.reaction} error={turn.reactionError} message={turn.user} reply={assistant.reply} onEdit={onEditUser ? () => onEditUser(turn) : undefined} />}
          <div className="message-actions" onDoubleClick={event => event.stopPropagation()}>
          {assistant.translation && <button type="button" className="message-translate" aria-label="Translate persona message" aria-expanded={showPersonaTranslation} onKeyDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setShowPersonaTranslation(!(showPersonaTranslation)) }}>Translate</button>}
          <button type="button" className="message-translate" aria-haspopup="dialog" onClick={bubbleTap}>Analysis</button>
          </div>
          {(showPersonaTranslation) && assistant.translation && (
            <div className="trans" dir="auto">{assistant.translation}</div>
          )}
          {['ready', 'running', 'waiting_dependencies'].includes(assistant.translationState ?? '') &&
            <ActivityIndicator label="Translating…" />}
          {assistant.translationState === 'failed' && <div className="trans" role="status">Translation failed</div>}
          {assistant.translationState === 'unknown' && <div className="trans" role="status">Translation outcome unknown</div>}
          {assistant.translationState === 'cancelled' && <div className="trans" role="status">Translation cancelled</div>}
          {assistant.translationState === 'invalidated' && <div className="trans" role="status">Translation unavailable</div>}
          <GlossAssistance assistant={assistant} onRetryGloss={onRetryGloss} />
          {speechError && <ErrorDetails label="Speech" errorKey={speechError}>{speechError}</ErrorDetails>}
          {ttsReady && onSpeak && (
            <button
              type="button"
              className="speak-btn"
              onDoubleClick={event => event.stopPropagation()}
              title={speaking ? 'Stop playback' : 'Speak reply'}
              aria-label={speaking ? 'Stop playback' : 'Speak reply'}
              onClick={(e) => {
                e.stopPropagation()
                onSpeak(assistant.reply, turn.id)
              }}
            >
              {speaking ? '⏹' : '🔊'}
            </button>
          )}
        </div>
      )}
      {assistant === null && (
        <div className="msg bot pending">{turn.pendingText}<ActivityIndicator compact label={turn.pendingText ? "Replying…" : "Thinking…"} /></div>
      )}
    </div>
  )
})
