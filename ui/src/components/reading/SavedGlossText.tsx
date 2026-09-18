import { AskCoachButton } from '../learning/AskCoachButton'
import { useOverlayLayer } from '../dialogs/useOverlayLayer'
import { DetailDialog } from '../dialogs/DetailDialog'
import { useI18n } from '../localization/i18n'
import { useUiDirection } from '../localization/useUiDirection'
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
  const tr = useI18n()
  const [expanded, setExpanded] = useState<number | null>(null)
  const uiDirection = useUiDirection()
  const { autoTranslate, alwaysRomanize, alwaysPronunciation, supportsRomanization } = useReadingPreferences()
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set())
  const [hovered, setHovered] = useState<number | null>(null)
  const hoveredWord = useRef<HTMLElement | null>(null)
  const helper = useRef<HTMLSpanElement>(null)
  // Both hosts of this text — the reply tray and the message stream — scroll and
  // clip their own box, so a helper anchored inside one of them is cut off at its
  // edge. It opens as a top-layer popover instead, placed against the word's
  // viewport box, and falls below the word only when there is no room above it.
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
  }, [hovered, revealed, expanded, autoTranslate, alwaysRomanize, alwaysPronunciation])
  useEffect(() => { setRevealed(new Set()); setHovered(null); setExpanded(null) }, [text])
  const pieces = []
  let cursor = 0
  for (const segment of glossDisplayGroups(text, supportsRomanization ? segments : segments.map(segment => ({ ...segment, romanization: undefined })))) {
    const annotations = segment.parts.filter(part => part.kind === 'gloss' && part.gloss !== null)
    const values = (field: 'gloss' | 'romanization' | 'pronunciation', className: string) => annotations.filter(part => part[field]).map(part => <span key={part.start} className={className} dir="auto" data-gloss-start={part.start} data-gloss-end={part.end}>{segment.parts.length > 1 && <><bdi>{text.slice(part.start, part.end)}</bdi>{': '}</>}{part[field]}</span>)
    // Under the word, a clitic group reads as one word: its sounds run together
    // ("al-" + "aklah" → "al-aklah") and its meanings read as a phrase. The
    // per-part labels stay in the helper, where there is room.
    const phrase = (field: 'gloss' | 'romanization' | 'pronunciation') => annotations.map(part => part[field]).filter(Boolean).join(field === 'gloss' ? ' ' : '')
    const joined = (field: 'gloss' | 'romanization' | 'pronunciation', className: string) => {
      const value = phrase(field)
      return value ? <span className={className} dir="auto" data-gloss-start={segment.start} data-gloss-end={segment.end}>{value}</span> : null
    }
    if (segment.start > cursor) pieces.push(<Fragment key={`gap-${cursor}`}>{text.slice(cursor, segment.start)}</Fragment>)
    const source = text.slice(segment.start, segment.end)
    const open = revealed.has(segment.start)
    const hovering = hovered === segment.start && !open
    const hasHiddenDetails = annotations.some(part => (!alwaysRomanize && part.romanization) || (!alwaysPronunciation && part.pronunciation))
    const toggle = () => {
      setHovered(null)
      setRevealed(previous => {
      return previous.has(segment.start) ? new Set<number>() : new Set([segment.start])
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
          {expanded === null && (open || (hovering && (!autoTranslate || hasHiddenDetails))) && <span ref={helper} className={`saved-word-help${segment.parts.length > 1 ? ' gloss-fragments' : ''}`} dir="auto" popover="manual"
            role="button" tabIndex={0} aria-label={tr("Word help")} aria-haspopup="dialog"
            onClick={event => { event.stopPropagation(); setExpanded(segment.start); setRevealed(new Set()); setHovered(null) }}
            onDoubleClick={event => event.stopPropagation()}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); event.currentTarget.click() } }}>
            {open && <PinnedGlossLayer host={helper} onClose={() => { setRevealed(new Set()); setHovered(null) }} />}
            {(!autoTranslate || open && !hasHiddenDetails) && values('gloss', 'wg')}
            {!alwaysRomanize && values('romanization', 'wroman')}
            {!alwaysPronunciation && values('pronunciation', 'wpronunciation')}
          </span>}
          {expanded === segment.start && <DetailDialog title={tr("Word help")} onClose={() => { setExpanded(null); hoveredWord.current?.focus() }}>
            <div className="saved-word-details" dir={uiDirection}>
              <h2 dir="auto">{source}</h2>
              {joined('gloss', 'wg')}
              {joined('romanization', 'wroman')}
              {joined('pronunciation', 'wpronunciation')}
              {annotations.length > 1 && <div className="saved-word-parts">{annotations.map(part => <div key={part.start} className="saved-word-part">
                <bdi className="saved-word-part-source">{text.slice(part.start, part.end)}</bdi>
                <span className="wg" dir="auto">{part.gloss}</span>
                {part.romanization && <span className="wroman" dir="auto">{part.romanization}</span>}
                {part.pronunciation && <span className="wpronunciation" dir="auto">{part.pronunciation}</span>}
              </div>)}</div>}
              <div className="detail-actions"><AskCoachButton
                question={`Help me understand “${source}” in this sentence: “${text}”. Saved word details: ${JSON.stringify(annotations.map(part => ({ text: text.slice(part.start, part.end), gloss: part.gloss, romanization: part.romanization, pronunciation: part.pronunciation })))}`}
                onClose={() => setExpanded(null)}
              /></div>
            </div>
          </DetailDialog>}
          {autoTranslate && joined('gloss', 'wg')}
          {alwaysRomanize && joined('romanization', 'wroman')}
          {alwaysPronunciation && joined('pronunciation', 'wpronunciation')}
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
