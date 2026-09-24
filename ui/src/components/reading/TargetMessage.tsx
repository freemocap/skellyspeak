import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { GlossSegment } from '../../generated/contracts'
import { errorDetails, errorMessage } from '../../platform/diagnostics/error-details'
import { ErrorDetails } from '../feedback/ErrorDetails'
import { ResponseDetails } from '../feedback/ResponseDetails'
import { useI18n } from '../localization/i18n'
import { useUiDirection } from '../localization/useUiDirection'
import { useReadingLookup, useReadingPeek, useReadingScope } from './ReadingContext'
import { useReadingPreferences } from './ReadingPreferences'
import { SavedGlossText } from './SavedGlossText'
import { TargetText } from './TargetText'
import { useSavedReading } from './SavedReadingProvider'
import { TranslationStatus, translationPending } from './TranslationStatus'

/// Where the message sits. `bubble` is a message in a thread with its actions
/// inside the bubble; `passage` is a standalone bubble with actions beneath it;
/// `compact` is inline text with actions beneath it.
export type TargetMessageLayout = 'bubble' | 'passage' | 'compact'

export interface TargetMessageSpeech {
  speaking: boolean
  onToggle: () => void
  error: { text: string; details: unknown } | null
}

export interface TargetMessageAnalysis {
  pending: boolean
  onOpen: () => void
}

export interface TargetMessageProps {
  text: string
  /// Word meanings already known for `text`, anchored by UTF-16 offsets.
  segments: GlossSegment[]
  /// Changes when a different set of saved meanings replaces the current one.
  segmentsKey: string
  translation: string | null
  /// Whole-message reading aids, shown when no word-level aid covers them.
  romanization: string | null
  pronunciation: string | null
  layout: TargetMessageLayout
  /// Accessible name of the translate toggle; `null` uses its visible label.
  translateLabel: string | null
  /// Saved meanings for this message are still being produced.
  segmentsPending: boolean
  /// Word by word and Translate may request aids through the reading lookup.
  lookupWords: boolean
  /// Owner-supplied progress and failures for this message's aids.
  status: ReactNode
  /// Operation state of a translation the owner requested for this text. The
  /// Translate control carries its progress; a reserved line shows it only
  /// while the translation is set to show and has no text yet.
  translationState?: string | null
  /// Optional actions supplied by the owning surface, without feature coupling.
  extraActions?: ReactNode
  /// Owner-supplied content shown directly under the text.
  annotation: ReactNode
  speech: TargetMessageSpeech | null
  analysis: TargetMessageAnalysis | null
  focused: boolean
  rtl: boolean
}

/** One target-language message with its reading tools: word meanings,
 *  translation, whole-message reading aid, read-aloud and analysis. Every
 *  consumer supplies its own data and actions; the tools behave identically. */
export function TargetMessage({
  text, segments, segmentsKey, translation, romanization, pronunciation, layout, translateLabel,
  segmentsPending, lookupWords, status, translationState, annotation, speech, analysis, focused, rtl, extraActions,
}: TargetMessageProps) {
  const tr = useI18n()
  const uiDirection = useUiDirection()
  const preferences = useReadingPreferences()
  const scope = useReadingScope(), saved = useSavedReading(), peek = useReadingPeek(), lookup = useReadingLookup()
  // Saved, cached and requested meanings come from the reading services only
  // when the owner allows lookup and a reading scope is present.
  const readingScope = lookupWords ? scope : null
  const canLookup = readingScope !== null && lookup !== null

  // Every lookup belongs to one source: this text in this reading scope.
  const sourceKey = readingScope ? JSON.stringify([readingScope, text]) : null
  const local = segments.length ? segments : readingScope ? saved(text, readingScope).filter(part => part.kind === 'gloss') : []
  const cachedResult = readingScope ? peek({ ...readingScope, text, aid:'word_gloss' }) : null
  const cached = cachedResult?.gloss?.segments ?? []
  const [fetchedResult, setFetchedResult] = useState<{ source: string; segments: GlossSegment[] } | null>(null)
  const fetched = fetchedResult !== null && fetchedResult.source === sourceKey ? fetchedResult.segments : []
  // A whole-passage result exists once the cache holds complete coverage or
  // this source's own lookup answered; saved or cached meanings may be partial.
  const lookedUp = cachedResult?.gloss?.coverage === 'complete' || (fetchedResult !== null && fetchedResult.source === sourceKey)
  const resolved = [...local, ...[...cached, ...fetched].filter(part => !local.some(item => item.start < part.end && item.end > part.start))]
  // Prefer one complete cached/fetched result over duplicating equivalent anchors.
  const known = resolved.filter((part, index) => !resolved.slice(0, index).some(item => item.start < part.end && item.end > part.start))

  const aidsEnabled = preferences.autoTranslate || preferences.alwaysRomanize || preferences.alwaysPronunciation
  const [wordsOverride, setWordsOverride] = useState<boolean | null>(null)
  const wordsOpen = wordsOverride ?? (aidsEnabled && known.length > 0)
  const [translationOverride, setTranslationOverride] = useState<boolean | null>(null)
  const translationOpen = translationOverride ?? preferences.autoTranslate
  const sound = preferences.supportsRomanization && romanization ? romanization : pronunciation
  const [soundOverride, setSoundOverride] = useState<boolean | null>(null)
  const soundOpen = soundOverride ?? (preferences.supportsRomanization && romanization ? preferences.alwaysRomanize : preferences.alwaysPronunciation)
  useEffect(() => { setWordsOverride(null) }, [preferences.autoTranslate, preferences.alwaysRomanize, preferences.alwaysPronunciation])

  const words = useSourceRequest(sourceKey)
  async function toggleWords() {
    // Missing meanings: one explicit click requests the whole passage and shows
    // it, even when a preference already shows the partial meanings.
    const request = !lookedUp && !words.pending && readingScope !== null && lookup !== null && sourceKey !== null
    setWordsOverride(request ? true : !wordsOpen)
    if (!request) return
    const source = sourceKey
    await words.run(signal => lookup({ ...readingScope, text, aid: 'word_gloss' }, signal),
      result => setFetchedResult({ source, segments: result.gloss?.segments ?? [] }))
  }

  // A supplied translation wins; otherwise the reading lookup may translate
  // this source on request, through the same translation contract as Chat.
  const cachedTranslation = readingScope ? peek({ ...readingScope, text, aid: 'translation' })?.translation ?? null : null
  const [fetchedTranslation, setFetchedTranslation] = useState<{ source: string; text: string } | null>(null)
  const shownTranslation = translation ?? cachedTranslation ?? (fetchedTranslation !== null && fetchedTranslation.source === sourceKey ? fetchedTranslation.text : null)
  const translating = useSourceRequest(sourceKey)
  // What the learner sees: a translation is shown only when one exists.
  const translationShown = translationOpen && shownTranslation !== null
  const translationWorking = translationPending(translationState)
  async function toggleTranslation() {
    if (shownTranslation !== null) { setTranslationOverride(!translationOpen); return }
    // Nothing to show yet: one explicit click requests it and shows it.
    setTranslationOverride(true)
    if (translating.pending || readingScope === null || lookup === null || sourceKey === null) return
    const source = sourceKey
    await translating.run(signal => lookup({ ...readingScope, text, aid: 'translation' }, signal), result => {
      if (result.translation === null) throw new Error('The reading service returned no translation.')
      setFetchedTranslation({ source, text: result.translation })
    })
  }

  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation()
  const body = <>
    {known.length > 0
      ? <SavedGlossText key={segmentsKey} text={text} segments={known} showAids={wordsOpen} revealAids={wordsOverride === true} />
      : <TargetText text={text} />}
    {annotation}
    {translationShown && <div className="trans" dir="auto">{shownTranslation}</div>}
    {translationState !== undefined && <TranslationStatus state={translationState} shown={translationOpen && shownTranslation === null} />}
    {soundOpen && sound && !(wordsOpen && known.some(part => part.romanization || part.pronunciation)) && <div className="wroman" dir="auto">{sound}</div>}
    {status}
    {speech && <button type="button" className="bubble-corner-control speak-btn" title={speech.speaking ? tr("Stop playback") : tr("Speak reply")} aria-label={speech.speaking ? tr("Stop playback") : tr("Speak reply")} onDoubleClick={stop} onClick={event => { stop(event); speech.onToggle() }}><span aria-hidden="true">{speech.speaking ? '⏹' : '🔊'}</span></button>}
    {speech?.error && <ErrorDetails label={tr("Speech")} errorKey={speech.error.text} explanation={speech.error.text}><ResponseDetails value={speech.error.details} /></ErrorDetails>}
  </>
  const actions = <div className="message-actions" dir={layout === 'bubble' ? uiDirection : undefined} onDoubleClick={stop}>
    {sound && <button type="button" className="message-translate" aria-expanded={soundOpen} aria-pressed={soundOpen} onClick={event => { stop(event); setSoundOverride(!soundOpen) }}>{tr('Pronunciation')}</button>}
    {(shownTranslation || canLookup || translationWorking) && <button type="button" className={translating.pending || translationWorking ? 'message-translate is-hydrating' : 'message-translate'} disabled={translating.pending} aria-label={translateLabel ?? undefined} aria-expanded={translationShown} aria-pressed={translationShown} onKeyDown={stop} onClick={event => { stop(event); void toggleTranslation() }}>{tr("Translate")}</button>}
    <button type="button" className={segmentsPending || words.pending ? 'message-translate is-hydrating' : 'message-translate'} disabled={words.pending || (known.length === 0 && !canLookup)} aria-expanded={wordsOpen} aria-pressed={wordsOpen} onClick={event => { stop(event); void toggleWords() }}>{tr("Word by word")}</button>
    {analysis && <button type="button" className={analysis.pending ? 'message-translate is-hydrating' : 'message-translate'} aria-haspopup="dialog" onClick={event => { stop(event); analysis.onOpen() }}>{tr("Analysis")}</button>}
    {extraActions}
  </div>
  const failure = <>
    {words.error != null && <ErrorDetails label={tr('Word meanings')} errorKey={errorMessage(words.error)} explanation={errorMessage(words.error)}><ResponseDetails value={errorDetails(words.error)} /></ErrorDetails>}
    {translating.error != null && <ErrorDetails label={tr('Translation')} errorKey={errorMessage(translating.error)} explanation={errorMessage(translating.error)}><ResponseDetails value={errorDetails(translating.error)} /></ErrorDetails>}
  </>

  // Meanings that are set to show and still being produced keep their line pitch.
  const aidsReserved = aidsEnabled && known.length === 0 && segmentsPending
  if (layout === 'bubble') return <div className={`msg chat-message bot with-actions${focused ? ' focused' : ''}${rtl ? ' rtl' : ''}${speech ? ' with-corner-control' : ''}${aidsReserved ? ' aids-reserved' : ''}`}>
    {body}{actions}{failure}
  </div>
  return <div className={`reading-passage${layout === 'compact' ? ' reading-passage-compact' : ''}`}>
    <div className={layout === 'compact' ? 'reading-passage-text' : 'msg chat-message bot'} dir="auto">{body}</div>
    {actions}{failure}
  </div>
}

/// One explicit reading request at a time for one source. A different source
/// aborts the request; its result, progress and failure never reach the new one.
function useSourceRequest(source: string | null) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    setPending(false); setError(null)
    return () => { controller.current?.abort(); controller.current = null }
  }, [source])
  async function run<T>(request: (signal: AbortSignal) => Promise<T>, publish: (value: T) => void) {
    const current = new AbortController(); controller.current = current
    setPending(true); setError(null)
    try {
      const value = await request(current.signal)
      if (!current.signal.aborted) publish(value)
    } catch (failure) { if (!current.signal.aborted) setError(failure) }
    finally { if (!current.signal.aborted) setPending(false) }
  }
  return { pending, error, run }
}
