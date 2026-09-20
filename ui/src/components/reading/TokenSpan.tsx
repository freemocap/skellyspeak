import { useReadingActions, useReadingScope } from './ReadingContext'
import { readingPassage } from '../../domain/reading/word-boundaries'
import { InspectText } from './InspectText'
import { TokenAudio } from './TokenAudio'
import { useEffect, useRef, useState } from 'react'
import type { GuidedToken } from '../../types'

interface TokenSpanProps {
  sourceText?: string
  sourceStart?: number
  textStyle?: React.CSSProperties
  interactive?: boolean
  tok: GuidedToken
  revealed: boolean
  hasTranslation: boolean
  showTranslation: boolean
  showAids: boolean
  showRomanization: boolean
  alwaysRomanize: boolean
  alwaysPronunciation: boolean
  onTap: (e: React.MouseEvent<HTMLSpanElement>) => void
  onDragStart: () => void
  onDragOver: () => void
  onInspect?: (e: React.MouseEvent<HTMLSpanElement>) => void
  onHold?: () => void
}

export function TokenSpan({
  tok,
  sourceText = tok.text,
  sourceStart = 0,
  textStyle,
  interactive = true,
  revealed,
  hasTranslation,
  showTranslation,
  showAids,
  showRomanization,
  alwaysRomanize,
  alwaysPronunciation,
  onTap,
  onDragStart,
  onDragOver,
  onInspect,
  onHold,
}: TokenSpanProps) {
  const readingActions = useReadingActions()
  const scope = useReadingScope()
  const tappable = interactive && (!!(tok.gloss || tok.pronunciation || tok.romanization) || hasTranslation || (readingActions && scope && /[\p{L}\p{N}]/u.test(tok.text)))
  // Press-and-hold (450ms, near-stationary) opens the deep word-insight
  // modal. Works for mouse + touch; a plain click never fires it, and
  // dragging cancels it.
  const holdTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
  }, [])
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
      onHold?.()
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
    if (!tok.gloss && !tok.pronunciation && !tok.romanization && readingActions && scope && /[\p{L}\p{N}]/u.test(tok.text)) {
      e.stopPropagation(); readingActions.inspect({ ...readingPassage(sourceText, sourceStart, sourceStart + tok.text.length), scope }); return
    }
    onTap(e)
  }
  return (
    <span className="wu" onClick={interactive ? (e) => e.stopPropagation() : undefined}>
      <span
        className={`w ${tok.notable ? 'notice' : ''}${tappable ? ' tap' : ''}${
          revealed ? ' revealed' : ''
        }${holding ? ' holding' : ''}`}
        style={textStyle}
        role={tappable ? 'button' : undefined}
        tabIndex={tappable ? 0 : undefined}
        onKeyDown={event => { if (tappable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); event.currentTarget.click() } }}
        data-gloss-trigger={tappable || undefined}
        onClick={tappable ? clickTap : undefined}
        onPointerDown={interactive && onHold ? startHold : undefined}
        onPointerMove={trackHoldMove}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onMouseDown={onDragStart}
        onMouseEnter={onDragOver}
        onContextMenu={interactive ? onInspect : undefined}
      >
        {tok.text}
      </span>
      {(revealed || showAids) && showTranslation && tok.gloss && <span className="wg">{tok.gloss}</span>}
      {revealed && interactive && <span><TokenAudio text={sourceText} start={sourceStart} end={sourceStart + tok.text.length} /><InspectText text={sourceText} start={sourceStart} end={sourceStart + tok.text.length} /></span>}
      {(revealed || showAids) && alwaysPronunciation && !tok.romanization && tok.pronunciation && <span className="wpronunciation" dir="auto">{tok.pronunciation}</span>}
      {/* Always-visible romanization does not depend on revealing the gloss. */}
      {(revealed || showAids) && alwaysRomanize && showRomanization && tok.romanization && (
        <span className="wroman">{tok.romanization}</span>
      )}
    </span>
  )
}

