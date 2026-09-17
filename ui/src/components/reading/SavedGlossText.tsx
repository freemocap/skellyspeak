import { useOverlayLayer } from '../dialogs/useOverlayLayer'
import { useIsMobile } from '../layout/useIsMobile'
import { useReadingPreferences } from './ReadingPreferences'
import { glossDisplayGroups } from '../../domain/reading/gloss-display'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { GlossSegment } from '../../generated/contracts'

function PinnedGlossLayer({ host, onClose }: { host: RefObject<HTMLSpanElement | null>; onClose: () => void }) {
  useOverlayLayer(host, onClose, false)
  return null
}

/** Saved UTF-16 anchors select exact source occurrences; reading never requests analysis. */
export function SavedGlossText({ text, segments, afterSegment, decorateSegment, interactive = true }: { interactive?: boolean; text: string; segments: GlossSegment[]; afterSegment?: (start: number, end: number) => ReactNode; decorateSegment?: (node: ReactNode, start: number, end: number) => ReactNode }) {
  const isMobile = useIsMobile()
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
    if (!element || !word) return
    element.showPopover()
    const position = () => {
      const box = word.getBoundingClientRect()
      const width = element.getBoundingClientRect().width
      const start = getComputedStyle(word).direction === 'rtl' ? box.right - width : box.left
      element.style.left = `${Math.max(8, Math.min(start, window.innerWidth - width - 8))}px`
      const height = element.getBoundingClientRect().height
      const above = box.top - height - 4
      element.style.top = `${above >= 8 ? above : Math.max(8, Math.min(box.bottom + 4, window.innerHeight - height - 8))}px`
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key !== 'Escape' : word.contains(event.target as Node) || element.contains(event.target as Node)) return
      setRevealed(new Set()); setHovered(null)
      if (event instanceof KeyboardEvent) word.focus()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => {
      window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true)
      document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss)
      if (element.isConnected && element.hasAttribute('popover')) element.hidePopover()
    }
  }, [hovered, revealed, isMobile, autoTranslate, alwaysRomanize, alwaysPronunciation])
  useEffect(() => { setRevealed(new Set()); setHovered(null) }, [text])
  useEffect(() => { if (!isMobile) setRevealed(previous => new Set([...previous].slice(-1))) }, [isMobile])
  const pieces = []
  let cursor = 0
  for (const segment of glossDisplayGroups(text, segments)) {
    const annotations = segment.parts.filter(part => part.kind === 'gloss' && part.gloss !== null)
    const values = (field: 'gloss' | 'romanization' | 'pronunciation', className: string) => annotations.filter(part => part[field]).map(part => <span key={part.start} className={className} dir="auto" data-gloss-start={part.start} data-gloss-end={part.end}>{segment.parts.length > 1 && <><bdi>{text.slice(part.start, part.end)}</bdi>{': '}</>}{part[field]}</span>)
    if (segment.start > cursor) pieces.push(<Fragment key={`gap-${cursor}`}>{text.slice(cursor, segment.start)}</Fragment>)
    const source = text.slice(segment.start, segment.end)
    const open = revealed.has(segment.start)
    const hovering = hovered === segment.start && !open
    const hasHiddenDetails = annotations.some(part => (!alwaysRomanize && part.romanization) || (!alwaysPronunciation && part.pronunciation))
    const toggle = () => {
      setHovered(null)
      setRevealed(previous => {
      const next = new Set(isMobile ? previous : [])
      if (previous.has(segment.start)) next.delete(segment.start)
      else next.add(segment.start)
      return next
    })
    }
    const piece = interactive && annotations.length > 0
      ? <span className="wu saved-word" key={segment.start} data-source-start={segment.start} data-source-end={segment.end} onPointerEnter={event => { if (event.pointerType === 'mouse' && revealed.size === 0) { hoveredWord.current = event.currentTarget; setHovered(segment.start) } }} onPointerLeave={() => setHovered(null)}>
          <span className={`w tap${open ? ' revealed' : ''}`} role="button" tabIndex={0} aria-expanded={open}
            onClick={event => { event.stopPropagation(); hoveredWord.current = event.currentTarget; toggle() }}
            onDoubleClick={event => event.stopPropagation()}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); hoveredWord.current = event.currentTarget; toggle() } }}>
            {source}
          </span>
          {(hovering || open) && (!autoTranslate || hasHiddenDetails) && <span ref={!isMobile || hovering ? helper : undefined} className={`${!isMobile || hovering ? 'saved-word-help' : 'saved-word-inline'}${segment.parts.length > 1 ? ' gloss-fragments' : ''}`} dir="auto" popover={!isMobile || hovering ? 'manual' : undefined}>
            {open && !isMobile && <PinnedGlossLayer host={helper} onClose={() => { setRevealed(new Set()); setHovered(null) }} />}
            {!autoTranslate && values('gloss', 'wg')}
            {!alwaysRomanize && values('romanization', 'wroman')}
            {!alwaysPronunciation && values('pronunciation', 'wpronunciation')}
          </span>}
          {autoTranslate && values('gloss', 'wg')}
          {alwaysRomanize && values('romanization', 'wroman')}
          {alwaysPronunciation && values('pronunciation', 'wpronunciation')}
        </span>
      : <Fragment key={segment.start}>{source}</Fragment>
    pieces.push(decorateSegment ? <Fragment key={segment.start}>{decorateSegment(piece, segment.start, segment.end)}</Fragment> : piece)
    if (afterSegment) pieces.push(<Fragment key={`credit-${segment.start}`}>{afterSegment(cursor, segment.end)}</Fragment>)
    cursor = segment.end
  }
  if (cursor < text.length) pieces.push(<Fragment key={`gap-${cursor}`}>{text.slice(cursor)}</Fragment>)
  if (afterSegment && cursor < text.length) pieces.push(<Fragment key="credit-tail">{afterSegment(cursor, text.length)}</Fragment>)
  return <span className="w preserve-space" dir="auto">{pieces}</span>
}
