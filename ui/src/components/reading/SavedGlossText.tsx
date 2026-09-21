import { createPortal } from 'react-dom'
import { positionWordHelp, wordHelpLayer } from './word-help-layer'
import { TokenAudio } from './TokenAudio'
import { GlossHelpParts } from './GlossHelpParts'
import { UnannotatedText } from './UnannotatedText'
import { AskCoachButton } from '../learning/AskCoachButton'
import { useOverlayLayer } from '../dialogs/useOverlayLayer'
import { DetailDialog } from '../dialogs/DetailDialog'
import { useI18n } from '../localization/i18n'
import { useUiDirection } from '../localization/useUiDirection'
import { useReadingPreferences } from './ReadingPreferences'
import { glossDisplayGroups } from '../../domain/reading/gloss-display'
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { GlossSegment } from '../../generated/contracts'

function PinnedGlossLayer({ host, onClose }: { host: RefObject<HTMLSpanElement | null>; onClose: () => void }) {
  useOverlayLayer(host, onClose, false)
  return null
}

/** Saved UTF-16 anchors select exact source occurrences; reading never requests analysis. */
export function SavedGlossText({ text, segments, afterSegment, decorateSegment, interactive = true, showAids = true, revealAids = false }: { revealAids?: boolean; showAids?: boolean; interactive?: boolean; text: string; segments: GlossSegment[]; afterSegment?: (start: number, end: number) => ReactNode; decorateSegment?: (node: ReactNode, start: number, end: number) => ReactNode }) {
  const tr = useI18n()
  const [expanded, setExpanded] = useState<number | null>(null)
  const uiDirection = useUiDirection()
  const { autoTranslate, alwaysRomanize, alwaysPronunciation, supportsRomanization } = useReadingPreferences()
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set())
  const [hovered, setHovered] = useState<number | null>(null)
  const hoveredWord = useRef<HTMLElement | null>(null)
  const helper = useRef<HTMLSpanElement>(null)
  const helperId = useId()
  const layer = wordHelpLayer(hoveredWord.current)
  const renderHelp = (node: ReactNode) => layer.touch ? createPortal(node, layer.host) : node
  const hoverExit = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keepHover = () => { if (hoverExit.current !== null) clearTimeout(hoverExit.current); hoverExit.current = null }
  const leaveHover = () => { keepHover(); hoverExit.current = setTimeout(() => setHovered(null), 200) }
  useEffect(() => () => { if (hoverExit.current !== null) clearTimeout(hoverExit.current) }, [])
  // Both hosts of this text — the reply tray and the message stream — scroll and
  // clip their own box, so a helper anchored inside one of them is cut off at its
  // edge. Desktop uses the top layer; touch uses an unclipped portal to avoid
  // the device's top-layer scaling bug. Both stay beside the source word.
  useLayoutEffect(() => {
    const element = helper.current
    const word = hoveredWord.current
    if (!element || !word) return
    if (element.hasAttribute('popover')) element.showPopover()
    const position = () => positionWordHelp(element, word)
    position()
    const observer = new ResizeObserver(position); observer.observe(element)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)
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
      observer.disconnect()
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
      window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true)
      document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss)
      if (element.isConnected && element.hasAttribute('popover')) element.hidePopover()
    }
  }, [hovered, revealed, expanded, autoTranslate, alwaysRomanize, alwaysPronunciation, showAids])
  useEffect(() => { setRevealed(new Set()); setHovered(null); setExpanded(null) }, [text])
  const pieces = []
  let cursor = 0
  for (const segment of glossDisplayGroups(text, segments)) {
    const annotations = segment.parts.filter(part => part.kind === 'gloss' && part.gloss !== null)
    // Under the word, a clitic group reads as one word: its sounds run together
    // ("al-" + "aklah" → "al-aklah") and its meanings read as a phrase. The
    // per-part values stay in the helper, where there is room.
    const phrase = (field: 'gloss' | 'romanization' | 'pronunciation') => annotations.map(part => field === 'pronunciation' && part.romanization ? undefined : part[field]).filter(Boolean).join(field === 'gloss' ? ' ' : '')
    const joined = (field: 'gloss' | 'romanization' | 'pronunciation', className: string) => {
      const value = phrase(field)
      return value ? <span className={className} dir="auto" data-gloss-start={segment.start} data-gloss-end={segment.end}>{value}</span> : null
    }
    if (segment.start > cursor) pieces.push(<Fragment key={`gap-${cursor}`}><UnannotatedText inline text={text.slice(cursor, segment.start)} interactive={interactive} /></Fragment>)
    const source = text.slice(segment.start, segment.end)
    const open = revealed.has(segment.start)
    const hovering = hovered === segment.start && !open
    const toggle = () => {
      setHovered(null)
      setRevealed(previous => {
      return previous.has(segment.start) ? new Set<number>() : new Set([segment.start])
    })
    }
    const piece = interactive && annotations.length > 0
      ? <span className="wu saved-word" key={segment.start} data-source-start={segment.start} data-source-end={segment.end} onPointerEnter={event => { keepHover(); if (event.pointerType === 'mouse' && revealed.size === 0) { hoveredWord.current = event.currentTarget; setHovered(segment.start) } }} onPointerLeave={leaveHover}>
          <span className={`reading-word${open ? ' revealed' : ''}`} role="button" tabIndex={0} aria-expanded={open} aria-controls={open || hovering ? helperId : undefined}
            onClick={event => { event.stopPropagation(); hoveredWord.current = event.currentTarget; toggle() }}
            onDoubleClick={event => event.stopPropagation()}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); hoveredWord.current = event.currentTarget; toggle() } }}>
            {source}
          </span>
          {expanded === null && (open || hovering) && renderHelp(<span id={helperId} ref={helper} className={`saved-word-help${segment.parts.length > 1 ? ' gloss-fragments' : ''}`} dir="auto" popover={layer.touch ? undefined : "manual"} data-word-help-layer={layer.touch ? "portal" : undefined}
            role="group" aria-label={tr("Word help")}
            onPointerEnter={keepHover} onPointerLeave={leaveHover}
            onClick={event => event.stopPropagation()}>
            <span role="button" tabIndex={0} aria-label={tr("Word help")} aria-haspopup="dialog"
              onClick={event => { event.stopPropagation(); setExpanded(segment.start); setRevealed(new Set()); setHovered(null) }}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); event.currentTarget.click() } }}>
            {open && <PinnedGlossLayer host={helper} onClose={() => { setRevealed(new Set()); setHovered(null) }} />}
            <GlossHelpParts text={text} parts={annotations} />
            </span><TokenAudio text={text} start={segment.start} end={segment.end} />
          </span>)}
          {expanded === segment.start && <DetailDialog title={tr("Word help")} onClose={() => { setExpanded(null); hoveredWord.current?.focus() }}>
            <div className="saved-word-details" dir={uiDirection}>
              <h2 dir="auto">{source}<TokenAudio text={text} start={segment.start} end={segment.end} /></h2>
              <GlossHelpParts text={text} parts={annotations} />
              <div className="detail-actions"><AskCoachButton
                question={`Help me understand “${source}” in this sentence: “${text}”. Saved word details: ${JSON.stringify(annotations.map(part => ({ text: text.slice(part.start, part.end), gloss: part.gloss, romanization: part.romanization, pronunciation: part.pronunciation })))}`}
                onClose={() => setExpanded(null)}
              /></div>
            </div>
          </DetailDialog>}
          {showAids && (revealAids || autoTranslate) && joined('gloss', 'wg')}
          {showAids && (revealAids || alwaysRomanize) && supportsRomanization && joined('romanization', 'wroman')}
          {showAids && (revealAids || alwaysPronunciation) && joined('pronunciation', 'wpronunciation')}
        </span>
      : <UnannotatedText inline key={segment.start} text={source} interactive={interactive} />
    pieces.push(decorateSegment ? <Fragment key={segment.start}>{decorateSegment(piece, segment.start, segment.end)}</Fragment> : piece)
    if (afterSegment) pieces.push(<Fragment key={`credit-${segment.start}`}>{afterSegment(cursor, segment.end)}</Fragment>)
    cursor = segment.end
  }
  if (cursor < text.length) pieces.push(<Fragment key={`gap-${cursor}`}><UnannotatedText inline text={text.slice(cursor)} interactive={interactive} /></Fragment>)
  if (afterSegment && cursor < text.length) pieces.push(<Fragment key="credit-tail">{afterSegment(cursor, text.length)}</Fragment>)
  return <span className="w preserve-space" dir="auto">{pieces}</span>
}
