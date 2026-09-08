import { RewardInspectionContext } from './RewardInspectionContext'
import { domainColors } from '../../lib/skill-domains'
import { ActivityIndicator } from '../ActivityIndicator'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { PracticeContext } from '../panes/PracticeContext'
import { createMessageEvidenceSelector, evidenceStyle, type MessageEvidence } from '../../lib/message-evidence'
import { Fragment, memo, useContext, useMemo, useRef, useState } from 'react'
import { MessageFeedback } from './MessageFeedback'
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
  onTap,
  onDragStart,
  onDragOver,
  onInspect,
  onHold,
}: TokenSpanProps) {
  const tappable = !!tok.gloss || hasTranslation
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
  const [dismissedCredits, setDismissedCredits] = useState<Set<string>>(() => new Set())
  const setRewardDetail = (items: MessageEvidence[]): void => {
    if (!inspection) throw new Error('XP inspection provider is missing')
    inspection.open(items, turn.id, turn.user ?? '')
  }
  const [showUserTranslation, setShowUserTranslation] = useState(false)
  const [showPartnerTranslation, setShowPartnerTranslation] = useState<boolean | null>(null)
  const creditMarkers = (items: MessageEvidence[]) => [...new Map(items.map(item => [item.id, item])).values()].filter(item => !dismissedCredits.has(item.id)).map(item => <button key={item.id} className="inline-xp-badge" style={{ color: domainColors(item.domainId).ink }} title={`${item.xp} XP · ${item.label}`} aria-label={`Collect ${item.xp} XP · ${item.label}`} onClick={event => {
    event.stopPropagation()
    setRewardDetail([item])
    const button = event.currentTarget
    const dismiss = () => setDismissedCredits(previous => new Set([...previous, item.id]))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { dismiss(); return }
    button.disabled = true
    const animation = button.animate([{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: 'translateY(-7px) scale(1.55)', opacity: 1, offset: .35 }, { transform: 'translateY(-20px) scale(.65)', opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' })
    animation.onfinish = dismiss
  }}>+{item.xp}</button>)
  const source = turn.user ?? ''
  const boundaries = [...new Set([0, source.length, ...evidence.flatMap(item => [item.start, item.end])])].sort((a, b) => a - b)
  const plainEvidence = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1]
    const matches = evidence.filter(item => item.start < end && item.end > start)
    const text = source.slice(start, end)
    return matches.length ? <Fragment key={start}><button className="message-evidence evidence-phrase" style={evidenceStyle(matches)} data-reward-evidence={JSON.stringify([...new Set(matches.map(item => item.id))])} onClick={event => { event.stopPropagation(); setRewardDetail(matches) }}>{text}</button>{creditMarkers(matches.filter(item => item.end === end))}</Fragment> : text
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
            onTap={(e) => { if (matches.length) { e.stopPropagation(); setRewardDetail(matches) } else tokenTap(tok, si, translation, e, [{ label: 'Explain this word', run: () => onHold(tok.text, rawText) }]) }}
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
          className={`msg me${userEntries.length ? '' : ' plain'}${rtl ? ' rtl' : ''}${onEditUser ? ' with-edit' : ''}`}
          onDoubleClick={() =>
            assistant && onToggleReveal(assistant.user_tokens.map((_, i) => `${turn.id}:me:${i}`))
          }
        >
          {userEntries.length > 0
            ? renderTokens(userEntries, turn.id, 'me', assistant?.user_translation ?? null, turn.user ?? '')
            : plainEvidence}
          {assistant?.user_translation && <><button type="button" className="message-translate" aria-label="Translate your message" aria-expanded={showUserTranslation} onClick={event => { event.stopPropagation(); setShowUserTranslation(!showUserTranslation) }}>Translate</button>{showUserTranslation && <div className="trans">{assistant.user_translation}</div>}</>}
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
          className={`msg bot ${focused ? 'focused' : ''}${ttsReady ? ' with-speak' : ''}${rtl ? ' rtl' : ''}`}
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
          {assistant.translation && <button type="button" className="message-translate" aria-label="Translate partner message" aria-expanded={showPartnerTranslation ?? autoTranslate} onKeyDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setShowPartnerTranslation(!(showPartnerTranslation ?? autoTranslate)) }}>Translate</button>}
          <button type="button" className="message-translate" onClick={bubbleTap}>Analysis</button>
          {(showPartnerTranslation ?? autoTranslate) && assistant.translation && (
            <div className="trans">{assistant.translation}</div>
          )}
          {ttsReady && (
            <button
              type="button"
              className="speak-btn"
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
