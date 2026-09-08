import { DetailDialog } from '../DetailDialog'
import { RewardInspectionContext } from './RewardInspectionContext'
import { InlineXpBadge } from './InlineXpBadge'
import { ActivityIndicator } from '../ActivityIndicator'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { PracticeContext } from '../panes/PracticeContext'
import { createMessageEvidenceSelector, evidenceStyle, type MessageEvidence } from '../../lib/message-evidence'
import { Fragment, memo, useContext, useMemo, useRef, useState } from 'react'
import { MessageFeedback } from './MessageFeedback'
import { PartnerReaction } from './PartnerReaction'
import type { CoachFeedback, GuidedToken, GuidedTurnResult } from '../../types'
import { popupAnchor, type PopupState } from '../GlossPopup'
import { groupSentences, splitSentences } from '../../lib/sentences'
import { needsSpaceBetween } from '../../lib/token-spacing'

export interface TurnShape {
  id: number
  user: string | null
  assistant: GuidedTurnResult | null
  pendingText: string
  coach?: CoachFeedback
  coachError?: string
  reaction?: import('../../types').PartnerReaction
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

interface TokenSpanProps {
  tok: GuidedToken
  revealed: boolean
  hasTranslation: boolean
  showRomanization: boolean
  alwaysRomanize: boolean
  alwaysPronunciation: boolean
  onTap: (e: React.MouseEvent<HTMLSpanElement>) => void
  onDragStart: () => void
  onDragOver: () => void
  onInspect: (e: React.MouseEvent<HTMLSpanElement>) => void
  onHold: () => void
}

function TokenSpan({
  tok,
  revealed,
  hasTranslation,
  showRomanization,
  alwaysRomanize,
  alwaysPronunciation,
  onTap,
  onDragStart,
  onDragOver,
  onInspect,
  onHold,
}: TokenSpanProps) {
  const tappable = !!(tok.gloss || tok.pronunciation || tok.romanization) || hasTranslation
  // Press-and-hold (450ms, near-stationary) opens the deep word-insight
  // modal. Works for mouse + touch; a plain click never fires it, and
  // dragging cancels it.
  const holdTimer = useRef<number | null>(null)
  const heldRef = useRef(false)
  const pressPos = useRef<{ x: number; y: number } | null>(null)
  const [holding, setHolding] = useState(false)
  const startHold = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    heldRef.current = false
    pressPos.current = { x: e.clientX, y: e.clientY }
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      heldRef.current = true
      setHolding(true)
      onHold()
    }, 450)
  }
  const cancelHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    setHolding(false)
  }
  const trackHoldMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (holdTimer.current === null) return
    const p = pressPos.current
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancelHold()
  }
  const clickTap = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (heldRef.current) {
      heldRef.current = false // the long-press just fired — suppress the click
      return
    }
    onTap(e)
  }
  return (
    <span className="wu" onClick={(e) => e.stopPropagation()}>
      <span
        className={`w ${tok.notable ? 'notice' : ''}${tappable ? ' tap' : ''}${
          revealed ? ' revealed' : ''
        }${holding ? ' holding' : ''}`}
        role={tappable ? 'button' : undefined}
        tabIndex={tappable ? 0 : undefined}
        onKeyDown={event => { if (tappable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); event.currentTarget.click() } }}
        data-gloss-trigger={tappable || undefined}
        onClick={tappable ? clickTap : undefined}
        onPointerDown={startHold}
        onPointerMove={trackHoldMove}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onMouseDown={onDragStart}
        onMouseEnter={onDragOver}
        onContextMenu={onInspect}
      >
        {tok.text}
      </span>
      {revealed && tok.gloss && <span className="wg">{tok.gloss}</span>}
      {(revealed || alwaysPronunciation) && tok.pronunciation && <span className="wpronunciation" dir="auto">{tok.pronunciation}</span>}
      {/* Always-visible romanization does not depend on revealing the gloss. */}
      {(revealed || alwaysRomanize) && showRomanization && tok.romanization && (
        <span className="wroman">{tok.romanization}</span>
      )}
    </span>
  )
}

export interface TurnViewProps {
  turn: TurnShape
  reviewing: boolean
  targetLangCode: string
  nativeLangCode: string
  onAskCoach: (question: string) => void
  focused: boolean
  ttsReady: boolean
  speaking: boolean
  revealed: Set<string>
  showRomanization: boolean
  alwaysRomanize: boolean
  alwaysPronunciation: boolean
  autoTranslate: boolean
  rtl: boolean
  onReveal: (keys: string[]) => void
  onBubbleTap: (id: number) => void
  onSpeak: (text: string, turnId: number) => void
  onPopup: React.Dispatch<React.SetStateAction<PopupState | null>>
  onInspect: (turnId: number, side: 'me' | 'bot', index: number) => void
  onHold: (word: string, sentence: string) => void
  onToggleReveal: (keys: string[]) => void
  /// Edit this turn's message and try again — the tutor (and coach) regenerate
  /// their response from the edited text. Omitted while a turn is in flight.
  onEditUser?: (turn: TurnShape) => void
}

/// Memoized: during streaming, every delta re-renders only the turn that
/// changed — not the whole conversation.
export const TurnView = memo(function TurnView({
  turn,
  reviewing,
  targetLangCode,
  nativeLangCode,
  onAskCoach,
  focused,
  ttsReady,
  speaking,
  revealed,
  showRomanization,
  alwaysRomanize,
  alwaysPronunciation,
  autoTranslate,
  rtl,
  onReveal,
  onBubbleTap,
  onSpeak,
  onPopup,
  onInspect,
  onHold,
  onToggleReveal,
  onEditUser,
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
  const [showPartnerTranslation, setShowPartnerTranslation] = useState(false)
  const [creditGenerations, setCreditGenerations] = useState<Record<string, number>>({})
  const restoreCredits = (items: MessageEvidence[]): void => setCreditGenerations(previous => {
    const next = { ...previous }
    for (const id of new Set(items.map(item => item.id))) next[id] = (previous[id] ?? 0) + 1
    return next
  })
  const creditMarkers = (items: MessageEvidence[]) => [...new Map(items.map(item => [item.id, item])).values()].map(item => <InlineXpBadge key={item.id} item={item} generation={creditGenerations[item.id] ?? 0} onOpen={() => setRewardDetail([item])} />)
  const source = turn.user ?? ''
  const boundaries = [...new Set([0, source.length, ...evidence.flatMap(item => [item.start, item.end])])].sort((a, b) => a - b)
  const plainEvidence = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]
    const matches = evidence.filter(item => item.start < end && item.end > start)
    const text = source.slice(start, end)
    return matches.length ? <Fragment key={start}><button className="message-evidence evidence-phrase" style={evidenceStyle(matches)} data-reward-evidence={JSON.stringify([...new Set(matches.map(item => item.id))])} onClick={event => { event.stopPropagation(); restoreCredits(matches) }}>{text}</button>{creditMarkers(matches.filter(item => item.end === end))}</Fragment> : text
  })
  const assistant = turn.assistant
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
      {entries.map(({ tok, si }, gi) => {
        const start = rawText.indexOf(tok.text, cursor)
        cursor = start < 0 ? rawText.length : start + tok.text.length
        const matches = side === 'me' && start >= 0 ? evidence.filter(item => item.start < cursor && item.end > start) : []
        const endingCredits = matches.filter(item => item.end <= cursor)
        const key = `${turnId}:${side}:${gi}`
        const isRevealed = revealed.has(key)
        const prev = gi > 0 ? entries[gi - 1].tok.text : ''
        const space = gi > 0 && needsSpaceBetween(prev, tok.text) ? ' ' : ''
        return (
          <Fragment key={`${side}-${gi}`}>
            {space}
          <span className={matches.length ? 'message-evidence' : undefined} style={evidenceStyle(matches)} data-reward-evidence={matches.length ? JSON.stringify([...new Set(matches.map(item => item.id))]) : undefined}>
          <TokenSpan
            key={`${side}-${gi}`}
            tok={tok}
            revealed={isRevealed}
            hasTranslation={!!translation}
            showRomanization={showRomanization}
            alwaysRomanize={alwaysRomanize}
            alwaysPronunciation={alwaysPronunciation}
            onTap={(e) => {
              e.stopPropagation()
              if (dragRef.current.moved) return
              if (matches.length) restoreCredits(matches)
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
            onHold={() => {
              const sents = splitSentences(rawText)
              onHold(tok.text, sents[si] ?? rawText)
            }}
          />
          </span>
          {creditMarkers(endingCredits)}
          </Fragment>
        )
      })}
    </span>
  )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {turn.user && (
        <div
          data-reward-message={turn.id}
          className={`msg me${userEntries.length ? '' : ' plain'}${rtl ? ' rtl' : ''}${onEditUser ? ' with-edit' : ''}${assistant?.user_translation ? ' with-actions' : ''}`}
          onDoubleClick={() =>
            assistant && onToggleReveal(assistant.user_tokens.map((_, i) => `${turn.id}:me:${i}`))
          }
        >
          {userEntries.length > 0
            ? renderTokens(userEntries, turn.id, 'me', assistant?.user_translation ?? null, turn.user ?? '')
            : plainEvidence}
          {assistant?.user_translation && <>
            {showUserTranslation && <DetailDialog title="Your message translation" onClose={() => setShowUserTranslation(false)}><h2>Your message translation</h2><p dir={rtl ? 'rtl' : 'ltr'}>{turn.user}</p><p dir="auto">{assistant.user_translation}</p></DetailDialog>}
            <div className="message-actions" onDoubleClick={event => event.stopPropagation()}>
              <button type="button" className="message-translate" aria-label="Translate your message" aria-haspopup="dialog" aria-expanded={showUserTranslation} onClick={event => { event.stopPropagation(); setShowUserTranslation(!showUserTranslation) }}>Translate</button>
            </div>
          </>}
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
      {turn.user && <MessageFeedback id={turn.id} text={turn.user} feedback={turn.coach} error={turn.coachError} reviewing={reviewing} targetLangCode={targetLangCode} nativeLangCode={nativeLangCode} onEdit={onEditUser ? () => onEditUser(turn) : undefined} onAsk={onAskCoach} />}
      {assistant && (
        <div
          onDoubleClick={() =>
            assistant && onToggleReveal(assistant.tokens.map((_, i) => `${turn.id}:bot:${i}`))
          }
          className={`msg bot with-actions ${focused ? 'focused' : ''}${ttsReady ? ' with-speak' : ''}${rtl ? ' rtl' : ''}`}
        >
          {assistant.tokens.length > 0 ? (
            renderTokens(
              replyEntries,
              turn.id,
              'bot',
              assistant.translation,
              assistant.reply
            )
          ) : (
            assistant.reply
          )}
          {/* Auto-translate shows the reply's translation without a tap; the
              per-sentence tap still works on top of it. */}
          {turn.user && <PartnerReaction reaction={turn.reaction} error={turn.reactionError} message={turn.user} reply={assistant.reply} onEdit={onEditUser ? () => onEditUser(turn) : undefined} />}
          <div className="message-actions" onDoubleClick={event => event.stopPropagation()}>
          {assistant.translation && <button type="button" className="message-translate" aria-label="Translate partner message" aria-haspopup="dialog" aria-expanded={showPartnerTranslation} onKeyDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setShowPartnerTranslation(true) }}>Translate</button>}
          <button type="button" className="message-translate" aria-haspopup="dialog" onClick={bubbleTap}>Analysis</button>
          </div>
          {autoTranslate && assistant.translation && (
            <div className="trans">{assistant.translation}</div>
          )}
          {showPartnerTranslation && assistant.translation && <DetailDialog title="Partner message translation" onClose={() => setShowPartnerTranslation(false)}><h2>Partner message translation</h2><p dir={rtl ? 'rtl' : 'ltr'}>{assistant.reply}</p><p dir="auto">{assistant.translation}</p></DetailDialog>}
          {ttsReady && (
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
        <div className="msg bot pending">{turn.pendingText}<ActivityIndicator label={turn.pendingText ? "Replying…" : "Thinking…"} /></div>
      )}
    </div>
  )
})
