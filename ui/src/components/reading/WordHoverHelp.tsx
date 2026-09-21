import { positionWordHelp, wordHelpLayer } from './word-help-layer'
import { errorMessage, errorDetails } from '../../platform/diagnostics/error-details'
import { useSavedReading } from './SavedReadingProvider'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../localization/i18n'
import { ResponseDetails } from '../feedback/ResponseDetails'
import { TokenAudio } from './TokenAudio'
import { GlossHelpParts } from './GlossHelpParts'
import { useReadingActions, useReadingLookup, useReadingPeek, type ReadingSelection } from './ReadingContext'
import { useReadingPreferences } from './ReadingPreferences'
import type { ReadingResult } from '../../generated/contracts'

/** A separate top-layer card never replaces or participates in source text layout. */
export function WordHoverHelp({ selection, anchor, pinned, onEnter, onLeave, onClose }: {
  selection: ReadingSelection; anchor: RefObject<HTMLSpanElement | null>; pinned: boolean
  onEnter: () => void; onLeave: () => void; onClose: () => void
}) {
  const tr = useI18n()
  const lookup = useReadingLookup()
  const peek = useReadingPeek()
  const saved = useSavedReading()
  const localParts = useMemo(() => {
    const source = saved(selection.text, selection.scope)
    const cached = peek({...selection.scope, text:selection.text, speech:false})?.gloss?.segments ?? []
    return [...source, ...cached.filter(part => !source.some(item => item.start < part.end && item.end > part.start))]
      .filter(part => part.start < selection.end && part.end > selection.start && part.kind === 'gloss')
  }, [saved, peek, selection])
  const actions = useReadingActions()
  const { supportsRomanization } = useReadingPreferences()
  const helper = useRef<HTMLSpanElement>(null)
  const layer = wordHelpLayer(anchor.current)
  const [result, setResult] = useState<ReadingResult | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!lookup || localParts.length) return
    const controller = new AbortController()
    setResult(null); setFailure(null)
    void lookup({ ...selection.scope, text: selection.text, speech: false }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setResult(value) })
      .catch(error => { if (!controller.signal.aborted) setFailure(error) })
    return () => controller.abort()
  }, [lookup, selection, attempt, localParts])
  useLayoutEffect(() => {
    const card = helper.current, word = anchor.current
    if (!card || !word) return
    if (card.hasAttribute('popover')) card.showPopover()
    const position = () => positionWordHelp(card, word)
    position()
    const observer = new ResizeObserver(position); observer.observe(card)
    window.visualViewport?.addEventListener('resize', position); window.visualViewport?.addEventListener('scroll', position)
    window.addEventListener('scroll', position, true); window.addEventListener('resize', position)
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !word.contains(event.target as Node) && !card.contains(event.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', dismiss)
    return () => {
      window.visualViewport?.removeEventListener('resize', position); window.visualViewport?.removeEventListener('scroll', position)
      observer.disconnect(); window.removeEventListener('scroll', position, true); window.removeEventListener('resize', position)
      document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', dismiss)
      if (card.isConnected && card.hasAttribute('popover')) card.hidePopover()
    }
  }, [anchor, onClose])
  const parts = localParts.length ? localParts : result?.gloss?.segments.filter(part => part.start < selection.end && part.end > selection.start && part.kind === 'gloss') ?? []
  return createPortal(<span ref={helper} popover={layer.touch ? undefined : "manual"} data-word-help-layer={layer.touch ? "portal" : undefined} className="saved-word-help reading-word-help" role="group" aria-label={tr('Word help')} data-reading-tools
    onPointerEnter={onEnter} onPointerLeave={() => { if (!pinned) onLeave() }} onClick={event => event.stopPropagation()}>
    <TokenAudio text={selection.text} start={selection.start} end={selection.end} />
    <span className="reading-help-source" dir="auto">{selection.text.slice(selection.start, selection.end)}</span>
    {!parts.length && !result && !failure && <span role="status">{tr('Finding word meanings…')}</span>}
    <GlossHelpParts text={selection.text} parts={parts} showRomanization={supportsRomanization} />
    {failure != null && <><span role="alert">{errorMessage(failure)}</span>
      <ResponseDetails value={errorDetails(failure)} /></>}
    {(failure != null || result && !parts.length) && <button className="reading-help-action" onClick={() => setAttempt(value => value + 1)}>{tr('Retry word meanings')}</button>}
    <button className="reading-help-action" onClick={() => { onClose(); actions?.inspect(selection) }}>{tr('Word help')}</button>
  </span>, layer.host)
}
