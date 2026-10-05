import { ExplanationCards } from './ExplanationCards'
import { SentenceCompletions } from './SentenceCompletions'
import { isSentenceBlank, sentenceBlanks } from '../../domain/reading/sentence-blanks'
import { createPortal } from 'react-dom'
import { supportsPopover } from '../controls/popover-support'
import { ErrorNotice } from '../feedback/ErrorNotice'
import { errorMessage as message, errorDetails as details } from '../../platform/diagnostics/error-details'
import { readingWords } from '../../domain/reading/word-boundaries'
import { SavedReadingContext, SavedReadingRegistryContext } from './SavedReadingProvider'
import { savedGlossIndex, type SavedGlossSource } from '../../domain/reading/saved-gloss-index'
import { AskCoachButton } from '../learning/AskCoachButton'
import { ReadingLanguageScope } from './ReadingLanguageScope'
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ReadingActionsContext, ReadingCompletionsContext, ReadingLookupContext, ReadingPeekContext, ReadingScopeContext, speechKey, type ReadingSelection, type ReadingServices } from './ReadingContext'
import { SavedGlossText } from './SavedGlossText'
import { TokenAudio } from './TokenAudio'
import { DetailDialog } from '../dialogs/DetailDialog'
import { ResponseDetails } from '../feedback/ResponseDetails'
import { useI18n } from '../localization/i18n'
import type { ReadingInput } from '../../generated/contracts'
import type { ReadingHelpResult as ReadingResult } from '../../domain/reading/reading-result'
import type { ReadingLookup } from './ReadingContext'

export interface ReadingLanguage { code: string; name: string; languageTag?: string; defaultVariety: string; varieties: { id: string; label: string }[] }


/** Shared reading services for explicit word and inspection actions.
 * Requests are made only by learner actions, never merely by rendering text. */
export function ReadingHelp({ services, languages, children }: { services: ReadingServices; languages: ReadingLanguage[]; children: ReactNode }) {
  const tr = useI18n()
  const [savedSources, setSavedSources] = useState<Record<string, SavedGlossSource[]>>({})
  const registerSources = useCallback((id: string, sources: SavedGlossSource[]) => {
    setSavedSources(previous => ({...previous, [id]: sources}))
    return () => setSavedSources(previous => { const next = {...previous}; delete next[id]; return next })
  }, [])
  const savedIndex = useMemo(() => savedGlossIndex(Object.values(savedSources).flat()), [savedSources])
  const scope = useContext(ReadingScopeContext)
  const [selection, setSelection] = useState<ReadingSelection | null>(null)
  const [speaking, setSpeaking] = useState<string | null>(null)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [speechError, setSpeechError] = useState<unknown>(null)
  const [speechReceipt, setSpeechReceipt] = useState<unknown>(null)
  const speech = useRef<AbortController | null>(null)
  // Mounted accepted annotations support synchronous display. Generated results live in native storage.
  const peek = useCallback((input: ReadingInput): ReadingResult | null => {
    if (input.aid !== 'word_gloss') return null
    const { text, aid: _aid, ...scope } = input
    const segments = savedIndex(text, scope)
    if (!segments.length) return null
    const complete = readingWords(text).filter(word => word.word).every(word => {
      let end = word.start
      for (const part of segments) if (part.kind === 'gloss' && part.start <= end && part.end > end) end = part.end
      return end >= word.end
    })
    return {gloss: {segments, coverage:complete ? 'complete' : 'partial'}, audioBase64:null, audioAlignment:null, translation:null, explanations:null, receipt:null}
  }, [savedIndex])
  const lookup = useCallback<ReadingLookup>(async (input, signal, options) => {
    signal.throwIfAborted()
    if (input.aid === 'speech') throw new Error('Read-aloud is requested through reading actions, not lookup.')
    if (!options?.retry && services.saved) {
      const accepted = await services.saved(input, signal)
      signal.throwIfAborted()
      const selected = options?.selection
      if (accepted && (selected ? accepted.gloss?.segments.some(part => part.kind === 'gloss' && part.start < selected.end && part.end > selected.start) : accepted.gloss?.coverage === 'complete')) return accepted
    }
    const saved = peek(input)
    const complete = { word_gloss: saved?.gloss?.coverage === 'complete', translation: saved?.translation != null, explanations: saved?.explanations != null, completions: saved?.explanations != null }[input.aid]
    if (complete && !options?.retry) return saved!
    const result = options?.retry
      ? await services.read(input, signal, { retry: true })
      : await services.read(input, signal)
    signal.throwIfAborted()
    return result
  }, [services, peek])
  const nativePopover = supportsPopover()
  const audioStatus = useRef<HTMLDivElement>(null)
  const stop = useCallback(() => { speech.current?.abort(); speech.current = null; setSpeaking(null) }, [])
  useEffect(() => {
    setSelection(null)
    return stop
  }, [stop, scope?.language, scope?.variety, scope?.explanation, scope?.explanationVariety])
  const inspect = useCallback((next: ReadingSelection) => { stop(); setSelection(next) }, [stop])
  const lastSpeech = useRef<ReadingSelection | null>(null)
  const speak = useCallback((next: ReadingSelection) => {
    lastSpeech.current = next
    stop(); setSpeechError(null); setSpeechReceipt(null); setLoadingAudio(true)
    const controller = new AbortController(); speech.current = controller
    setSpeaking(speechKey(next))
    void services.speak({ ...next.scope, text: next.text.slice(next.start, next.end), aid:'speech' }, controller.signal, () => { if (!controller.signal.aborted) setLoadingAudio(false) }, next)
      .then(receipt => { if (!controller.signal.aborted) setSpeechReceipt(receipt) })
      .catch(error => { if (!controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) setSpeechError(error) })
      .finally(() => { if (speech.current === controller) { speech.current = null; setSpeaking(null) } })
  }, [services, stop])
  useLayoutEffect(() => {
    const node = audioStatus.current
    if (node && nativePopover) { node.showPopover(); return () => { if (node.isConnected) node.hidePopover() } }
  }, [speaking, speechError, speechReceipt])
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') { stop(); setSelection(null) } }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [stop])
  return <SavedReadingRegistryContext value={registerSources}><SavedReadingContext value={savedIndex}><ReadingActionsContext value={{ inspect, speak, stop, speaking }}>
    <ReadingPeekContext value={peek}><ReadingLookupContext value={lookup}><ReadingCompletionsContext value={SentenceCompletions}>{children}
    {selection && <ReadingInspector key={JSON.stringify(selection)} selection={selection} languages={languages} onClose={() => { stop(); setSelection(null) }} />}
    {(speechError != null || speechReceipt != null || speaking != null) && createPortal(<div ref={audioStatus} popover={nativePopover ? "manual" : undefined} className="reading-audio-status" data-reading-tools>
      {speaking && <><span role="status">{tr(loadingAudio ? 'Loading speech…' : 'Reading aloud…')}</span><button className="btn" onClick={stop}>{tr('Stop reading')}</button></>}
      {speechError != null && <ErrorNotice onRetry={() => { if (lastSpeech.current) speak(lastSpeech.current) }} error={speechError}>{message(speechError)}<ResponseDetails value={details(speechError)} /></ErrorNotice>}
      {speechReceipt != null && <ResponseDetails value={speechReceipt} />}
      {!speaking && <button className="btn" onClick={() => { setSpeechError(null); setSpeechReceipt(null) }}>{tr('Close')}</button>}
    </div>, document.body)}
  </ReadingCompletionsContext></ReadingLookupContext></ReadingPeekContext></ReadingActionsContext></SavedReadingContext></SavedReadingRegistryContext>
}

function ReadingInspector({ selection, languages, onClose }: { selection: ReadingSelection; languages: ReadingLanguage[]; onClose: () => void }) {
  const tr = useI18n()
  const aid = selection.aid ?? (isSentenceBlank(selection.text, selection.start, selection.end) ? 'explanations' : 'word_gloss')
  const analyzing = aid !== 'word_gloss'
  const blankSelection = isSentenceBlank(selection.text, selection.start, selection.end, aid === 'completions')
  const title = tr(analyzing ? 'Message analysis' : 'Word help')
  const lookup = useContext(ReadingLookupContext)!
  const peek = useContext(ReadingPeekContext)
  // Saved-source refreshes replace these functions without changing the question.
  // They must not cancel an in-flight request for the open inspector.
  const readers = useRef({ lookup, peek })
  readers.current = { lookup, peek }
  const scope = selection.scope
  const [result, setResult] = useState<ReadingResult | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const lastRequest = useRef<string | null>(null)
  useEffect(() => {
    const { lookup, peek } = readers.current
    const requestKey = JSON.stringify([scope, selection.text, aid, attempt])
    const saved = peek({...scope, text:selection.text, aid})
    if (saved && (attempt === 0 || lastRequest.current === requestKey)) { setResult(saved); setFailure(null); setPending(false); return }
    const controller = new AbortController()
    setResult(null); setFailure(null); setPending(true)
    lastRequest.current = requestKey
    void lookup({ ...scope, text: selection.text, aid }, controller.signal, { retry: attempt > 0, selection: { start: selection.start, end: selection.end } })
      .then(value => { if (!controller.signal.aborted) {
        setResult(value)
      } })
      .catch(error => { if (!controller.signal.aborted) setFailure(error) })
      .finally(() => { if (!controller.signal.aborted) setPending(false) })
    return () => controller.abort()
  }, [scope, attempt, selection.text, selection.start, selection.end, aid])
  const language = languages.find(item => item.code === scope.language)
  // A whole-text selection (phrase and inspect icons, message analysis) reads once,
  // with its meanings shown; a word inside a sentence keeps its own line first.
  const whole = selection.start === 0 && selection.end === selection.text.length
  return <DetailDialog title={title} onClose={onClose}><div data-reading-tools>
    <h2>{title}</h2>
    <ReadingScopeContext value={scope}><ReadingLanguageScope language={scope.language} variety={scope.variety}>
      {!whole && <p className="reading-selected-word" dir="auto" lang={language?.languageTag}><span>{selection.text.slice(selection.start, selection.end)}</span>{!blankSelection && <TokenAudio text={selection.text} start={selection.start} end={selection.end} />}</p>}
      <p className={whole ? 'reading-selected-word' : undefined} dir="auto" lang={language?.languageTag}><SavedGlossText text={selection.text} segments={result?.gloss?.segments ?? []} revealAids />{whole && !blankSelection && <TokenAudio text={selection.text} />}</p>
    </ReadingLanguageScope></ReadingScopeContext>
    {analyzing && result?.explanations && <ReadingScopeContext value={scope}>{aid === 'completions' || sentenceBlanks(selection.text).length
      ? <SentenceCompletions cards={result.explanations.cards} />
      : <ExplanationCards cards={result.explanations.cards} nativeLanguageName={scope.explanation} />}</ReadingScopeContext>}
    {pending && <p role="status">{tr(analyzing ? 'Working out the grammar…' : 'Finding word meanings…')}</p>}
    {failure != null && <ErrorNotice error={failure}>{message(failure)}<ResponseDetails value={details(failure)} /></ErrorNotice>}
    {(failure != null || result?.gloss?.coverage === 'partial') && <button className="btn" disabled={pending} onClick={() => setAttempt(value => value + 1)}>{tr(analyzing ? 'Retry' : 'Retry word meanings')}</button>}
    <AskCoachButton question={`Help me understand “${selection.text.slice(selection.start, selection.end)}” in this ${scope.language} passage: “${selection.text}”.`} onClose={onClose} />
  </div></DetailDialog>
}
