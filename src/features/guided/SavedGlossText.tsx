import { useReadingPreferences } from '../../ui/ReadingPreferences'
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { GlossSegment } from '../../contracts'

/** Saved UTF-16 anchors select exact source occurrences; reading never requests analysis. */
export function SavedGlossText({ text, segments, afterSegment, decorateSegment }: { text: string; segments: GlossSegment[]; afterSegment?: (start: number, end: number) => ReactNode; decorateSegment?: (node: ReactNode, start: number, end: number) => ReactNode }) {
  const { autoTranslate, alwaysRomanize, alwaysPronunciation } = useReadingPreferences()
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set())
  const [hovered, setHovered] = useState<number | null>(null)
  const hoveredWord = useRef<HTMLElement | null>(null)
  const helper = useRef<HTMLSpanElement>(null)
  // Both hosts of this text — the reply tray and the message stream — scroll and
  // clip their own box, so a helper anchored inside one of them is cut off at its
  // edge. It opens as a top-layer popover instead, placed against the word's
  // viewport box, and falls below the word when there is no room above it.
  useLayoutEffect(() => {
    const element = helper.current
    const word = hoveredWord.current
    if (hovered === null || !element || !word) return
    element.showPopover()
    const box = word.getBoundingClientRect()
    const width = element.getBoundingClientRect().width
    const start = getComputedStyle(word).direction === 'rtl' ? box.right - width : box.left
    element.style.left = `${Math.max(8, Math.min(start, window.innerWidth - width - 8))}px`
    const height = element.getBoundingClientRect().height
    const above = box.top - height - 4
    element.style.top = `${above >= 8 ? above : Math.max(8, Math.min(box.bottom + 4, window.innerHeight - height - 8))}px`
    return () => { if (element.isConnected) element.hidePopover() }
  }, [hovered])
  const pieces = []
  let cursor = 0
  for (const segment of segments) {
    if (segment.start > cursor) pieces.push(<Fragment key={`gap-${cursor}`}>{text.slice(cursor, segment.start)}</Fragment>)
    const source = text.slice(segment.start, segment.end)
    const open = revealed.has(segment.start)
    const hovering = hovered === segment.start && !open
    const toggle = () => setRevealed(previous => {
      const next = new Set(previous)
      if (next.has(segment.start)) next.delete(segment.start)
      else next.add(segment.start)
      return next
    })
    const piece = segment.kind === 'gloss' && segment.gloss !== null
      ? <span className="wu saved-word" key={segment.start} data-source-start={segment.start} data-source-end={segment.end} onPointerEnter={event => { if (event.pointerType === 'mouse') { hoveredWord.current = event.currentTarget; setHovered(segment.start) } }} onPointerLeave={() => setHovered(null)}>
          <span className={`w tap${open ? ' revealed' : ''}`} role="button" tabIndex={0} aria-expanded={open}
            onClick={event => { event.stopPropagation(); toggle() }}
            onDoubleClick={event => event.stopPropagation()}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); toggle() } }}>
            {source}
          </span>
          {hovering && <span ref={helper} className="saved-word-help" dir="auto" popover="manual">{!autoTranslate && <span className="wg">{segment.gloss}</span>}{!alwaysRomanize && segment.romanization && <span className="wroman" dir="ltr">{segment.romanization}</span>}{!alwaysPronunciation && segment.pronunciation && <span className="wpronunciation" dir="ltr">{segment.pronunciation}</span>}</span>}
          {(autoTranslate || open) && <span className="wg">{segment.gloss}</span>}
          {(alwaysRomanize || open) && segment.romanization && <span className="wroman" dir="ltr">{segment.romanization}</span>}
          {(alwaysPronunciation || open) && segment.pronunciation && <span className="wpronunciation" dir="ltr">{segment.pronunciation}</span>}
        </span>
      : <Fragment key={segment.start}>{source}</Fragment>
    pieces.push(decorateSegment ? <Fragment key={segment.start}>{decorateSegment(piece, segment.start, segment.end)}</Fragment> : piece)
    if (afterSegment) pieces.push(<Fragment key={`credit-${segment.start}`}>{afterSegment(cursor, segment.end)}</Fragment>)
    cursor = segment.end
  }
  if (cursor < text.length) pieces.push(<Fragment key={`gap-${cursor}`}>{text.slice(cursor)}</Fragment>)
  if (afterSegment && cursor < text.length) pieces.push(<Fragment key="credit-tail">{afterSegment(cursor, text.length)}</Fragment>)
  return <span className="w" dir="auto" style={{ whiteSpace: 'pre-wrap' }}>{pieces}</span>
}
