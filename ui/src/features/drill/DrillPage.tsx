import { useAudibleScrub } from './useAudibleScrub'
import { useClipPreview } from './useClipPreview'
import { TakeQueue } from './TakeQueue'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { reportFault } from '../../platform/diagnostics/faults'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { onRecordingPublished } from '../../platform/audio/recording-events'
import { useMicRecorder } from '../../platform/audio/useMicRecorder'
import { replaySelectionAudio, speakSelection } from '../../platform/audio/reading-speech'
import { cachedReadingAudio } from '../../platform/ipc/reading'
import type { PlaybackHandle, PlaybackObserver } from '../../platform/audio/speech-player'
import { CONTINUOUS_RECORDING_POLICY } from '../../generated/contracts'
import { TargetMessage } from '../../components/reading/TargetMessage'
import { ReadingLanguageScope } from '../../components/reading/ReadingLanguageScope'
import { ReadingScopeContext } from '../../components/reading/ReadingContext'
import { ResizeHandle, useStoredSize } from '../../components/layout/ResizeHandle'
import { languageFor } from '../../platform/ipc/tauri'
import { useSettingsStore } from '../../state/settings/settings'
import { clearDrillAttempts, deleteDrillAttempt, deleteDrillItem, drillItems, lastDrillItem, inspectDrillAudio } from '../../platform/ipc/drill'
import type { AudioInspection, DrillAttemptView, DrillItemView, ListeningSettings } from '../../generated/contracts'
import { useDrillVisit } from './useDrillVisit'
import { useDrillAttempts } from './useDrillAttempts'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { DrillLayout } from './DrillLayout'
import { AttemptInspection } from './AttemptInspection'
import { DrillComparison, type TimeDirection, type TimeScale } from './DrillComparison'
import { AttemptRows } from './AttemptRows'
import { ClearTakes } from './ClearTakes'
import { useAttemptAudio } from './useAttemptAudio'
import { DrillStorage } from './DrillStorage'
import { DrillAnalysis } from './DrillAnalysis'
import { PhraseRail } from './PhraseRail'
import { AddPhrases } from './AddPhrases'
import { RecordDock, dockPhase, type RecordMode } from './RecordDock'

/** The reference reading of one phrase: its audio and that audio's analysis. */
interface Reference { itemId: string; audioBase64: string; inspection: AudioInspection }

/** Practise saying one line: hear it, say it, see how close you were.
 *
 * Everything but the item, the attempt and the comparison is shared with Chat —
 * the target card, the recorder, the transcription and the spectrogram. */
export function DrillPage({ active }: { active: boolean }) {
  const tr = useI18n()
  const settings = useSettingsStore(state => state.settings)
  // New phrases are created in the language being practised now; an existing
  // item carries its own scope, which is what its aids and recordings use.
  const creating = useMemo(() => settings && {
    language: settings.target_language,
    variety: settings.target_variety,
    explanation: settings.native_language,
    explanationVariety: settings.native_variety,
  }, [settings])
  const [items, setItems] = useState<DrillItemView[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  // A phrase list that could not be read is said out loud, not only logged: an
  // empty page would otherwise read as "you have no phrases".
  const [loadFailure, setLoadFailure] = useState<unknown>(null)
  const [referenceFailure, setReferenceFailure] = useState<unknown>(null)
  const [reference, setReference] = useState<Reference | null>(null)
  // Which attempt the panel is showing. Nothing chosen means the newest one, so
  // a fresh attempt takes the panel without the learner asking.
  const [chosenAttemptId, setChosenAttemptId] = useState<string | null>(null)
  const [showUnscored, setShowUnscored] = useState(false)
  const [asking, setAsking] = useState(false)
  const savingPreference = useSettingsStore(state => state.savingPreference)
  const setPreference = useSettingsStore(state => state.setPreference)
  const [speaking, setSpeaking] = useState(false)
  const [mode, setMode] = useState<RecordMode>('live')
  const [autoDetect, setAutoDetect] = useState(true)
  const [listening, setListening] = useState<ListeningSettings>({
    pauseMs: CONTINUOUS_RECORDING_POLICY.defaultPauseMs,
    thresholdDb: CONTINUOUS_RECORDING_POLICY.defaultThresholdDb,
    minTakeMs: CONTINUOUS_RECORDING_POLICY.defaultMinTakeMs,
    silenceTimeoutMs: CONTINUOUS_RECORDING_POLICY.defaultSilenceTimeoutMs,
  })
  // Audio runs left-to-right independently of the phrase's writing direction.
  const [chosenDirection, setChosenDirection] = useState<TimeDirection | null>(null)
  const [timeScale, setTimeScale] = useState<TimeScale>('words')
  const [playingAttempt, setPlayingAttempt] = useState(false)
  const [attemptTime, setAttemptTime] = useState(0)
  // Every split on the page can be dragged; each size is kept for next time.
  const [reportWidth, setReportWidth] = useStoredSize('drill-report')
  const [dockHeight, setDockHeight] = useStoredSize('drill-dock')
  const page = useRef<HTMLElement>(null)
  const panes = useRef<Record<'dock' | 'attempts' | 'report', HTMLElement | null>>({ dock: null, attempts: null, report: null })
  const measure = (name: keyof typeof panes.current) => () => {
    const element = panes.current[name]
    if (!element) throw new Error(`The ${name} pane is not on the page.`)
    return name === 'report' ? element.getBoundingClientRect().width : element.getBoundingClientRect().height
  }

  const px = (size: number | null) => size === null ? undefined : `${Math.round(size)}px`
  const attemptPlayback = useRef<AbortController | null>(null)
  const [referenceTime, setReferenceTime] = useState(0)
  const attemptPlayer = useRef<PlaybackHandle | null>(null)
  const referencePlayer = useRef<PlaybackHandle | null>(null)
  const playbackRate = useRef(settings?.tts_rate ?? 1)
  playbackRate.current = settings?.tts_rate ?? 1
  const selected = items.find(item => item.id === selectedId) ?? null
  useEffect(() => {
    if (!selected || selected.language !== creating?.language) return
    try { localStorage.setItem(`skellyspeak_drill_phrase_${selected.language}`, selected.id) }
    catch (error) { setFailure(error); reportFault('Saving selected drill phrase', error) }
  }, [selected?.id, selected?.language, creating?.language])
  // The item's own stored scope: an aid asks about the phrase as it was written,
  // not as today's settings happen to read.
  const scope = useMemo(() => selected && {
    language: selected.language,
    variety: selected.variety,
    explanation: selected.explanation,
    explanationVariety: selected.explanationVariety,
  }, [selected])

  const showingLanguage = useRef(creating?.language)
  showingLanguage.current = creating?.language
  const mounted = useRef(false)
  const loading = useRef(0)
  const selectionGeneration = useRef(0)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; loading.current++ } }, [])
  const reload = useCallback(async (keep?: string) => {
    if (!creating) return
    const request = ++loading.current
    const generation = selectionGeneration.current
    const language = creating.language
    const [loaded, lastVisited] = await Promise.all([drillItems(language), lastDrillItem(language)])
    if (!mounted.current || request !== loading.current || showingLanguage.current !== language) return
    const remembered = localStorage.getItem(`skellyspeak_drill_phrase_${language}`)
    setItems(loaded)
    setSelectedId(current => generation === selectionGeneration.current && keep
      ? keep : loaded.some(item => item.id === current) ? current
        : loaded.some(item => item.id === lastVisited) ? lastVisited
          : loaded.some(item => item.id === remembered) ? remembered : loaded[0]?.id ?? null)
  }, [creating?.language])
  const refresh = useCallback((keep?: string) => {
    void reload(keep)
      .then(() => { if (mounted.current) setLoadFailure(null) })
      .catch(error => { if (mounted.current) setLoadFailure(error); reportFault('Loading drill items', error) })
  }, [reload])
  useEffect(() => {
    if (!active) return
    setItems([]); setSelectedId(null); setLoadFailure(null)
    refresh()
    const unsubscribe = onRecordingPublished(owner => { if (owner.kind === 'drillItem') refresh() })
    return () => { unsubscribe(); loading.current++ }
  }, [active, refresh])

  const history = useDrillAttempts(selected?.id ?? null, active)
  const newestTake = useRef<{ item: string | null; id: string | null }>({ item: null, id: null })
  // The take that just arrived, for the length of one movement: the rows it
  // displaced step down to make room for it. Nothing is set on a first read, so
  // opening a phrase moves nothing.
  const [arrivedId, setArrivedId] = useState<string | null>(null)
  const clearArrival = useCallback(() => setArrivedId(null), [])
  useEffect(() => {
    const id = history.attempts[0]?.id ?? null
    const item = selected?.id ?? null
    if (id && newestTake.current.id && newestTake.current.item === item && newestTake.current.id !== id) {
      setChosenAttemptId(null)
      setArrivedId(id)
    }
    newestTake.current = { item, id }
  }, [history.attempts[0]?.id, selected?.id])
  const visit = useDrillVisit(active, creating?.language ?? null, selected?.id ?? null)
  const owner = useMemo(() => active && visit.visitId && selected ? { kind: 'drillItem' as const, id: selected.id } : null, [active, selected?.id, visit.visitId])
  const mic = useMicRecorder({ owner, onTranscribe: () => {}, listening, captureMode: mode === 'live' ? (autoDetect ? 'auto' : 'monitor') : 'manual' })
  const clip = useClipPreview(owner?.id ?? null, mic.listeningStatus)
  useEffect(() => { if (clip.preview) setChosenAttemptId(null) }, [clip.preview?.recordingId])
  const phase = dockPhase({ ready: visit.visitId !== null, recording: mic.recording, transcribing: mic.transcribing })
  // The microphone and the speakers share one authority, so neither reference
  // playback nor replay runs while an attempt is being captured or stored.
  const holdingAudio = mic.recording || mic.transcribing

  const changeListening = (next: ListeningSettings) => {
    setListening(next)
    if (mic.recording && mic.listeningStatus?.listening) mic.tune(next)
  }

  const changeMode = (next: RecordMode) => { if (!mic.recording && !mic.starting) setMode(next) }
  const changeAutoDetect = (enabled: boolean) => {
    setAutoDetect(enabled)
    if (mic.recording && mode === 'live') mic.tune(listening, enabled ? 'auto' : 'monitor')
  }
  const holdSession = useRef<{ began: number; ready: Promise<void>; released: boolean } | null>(null)
  useEffect(() => () => { holdSession.current = null }, [owner?.id])
  const holdStart = () => {
    if (holdSession.current || mic.recording) return
    holdSession.current = { began: Date.now(), ready: mic.toggleMic(), released: false }
  }
  const holdEnd = () => {
    const session = holdSession.current
    if (!session || session.released) return
    session.released = true
    if (Date.now() - session.began < listening.minTakeMs) {
      holdSession.current = null
      mic.cancel()
    } else void session.ready.then(async () => {
      if (holdSession.current !== session) return
      await mic.stopMic()
      holdSession.current = null
    })
  }

  // Deleting takes changes the item's counts and its history, so both are read again.
  const [removedRecordings, setRemovedRecordings] = useState<Set<string>>(new Set())
  const [deletingTakes, setDeletingTakes] = useState(false)
  const removeTakes = async (run: () => Promise<unknown>) => {
    setDeletingTakes(true); setFailure(null)
    try { await run(); setChosenAttemptId(null); history.retry(); await reload(selected?.id) }
    catch (error) { setFailure(error) } finally { setDeletingTakes(false) }
  }
  const deleteTake = (take: DrillAttemptView) => void removeTakes(async () => {
    await deleteDrillAttempt(take.id)
    if (take.transcriptionAttemptId) setRemovedRecordings(ids => new Set([...ids, take.transcriptionAttemptId!]))
  })
  const clearTakes = (since: Date | null) => {
    if (!selected) throw new Error('Clearing takes needs a selected phrase.')
    const item = selected.id
    void removeTakes(async () => {
      await clearDrillAttempts(item, since?.toISOString() ?? null)
      // Capture is held while clearing; every live receipt belongs to this visit.
      const ids = history.attempts.filter(take => !since || new Date(take.createdAt) >= since)
        .flatMap(take => take.transcriptionAttemptId ? [take.transcriptionAttemptId] : [])
      setRemovedRecordings(previous => new Set([...previous, ...ids]))
    })
  }

  const remove = async (item: DrillItemView) => {
    setBusy(true); setFailure(null)
    try { await deleteDrillItem(item.id); await reload() }
    catch (error) { setFailure(error) } finally { setBusy(false) }
  }

  /// Play the item the way it should sound, and keep the audio so its
  /// spectrogram can sit beside the learner's. The audio is reused: replaying a
  /// native cache checks the current source and speech configuration on every play.
  const referenceRequest = useRef<AbortController | null>(null)
  useEffect(() => {
    setSpeaking(false); setFailure(null); setReferenceFailure(null); setReference(null); setReferenceTime(0); referencePlayer.current = null
    if (active && selected && scope) {
      const itemId = selected.id
      const controller = new AbortController()
      referenceRequest.current = controller
      const current = () => referenceRequest.current === controller && !controller.signal.aborted
      void cachedReadingAudio({ ...scope, text: selected.text, aid: 'speech', referenceItem: itemId }).then(async audio => {
        if (!audio || !current()) return
        const { audioBase64 } = audio
        const inspection = await inspectDrillAudio(itemId, audioBase64, { speechAlignment: audio.alignment })
        if (current()) setReference({ itemId, audioBase64, inspection })
      }).catch(error => { if (current()) setReferenceFailure(error) })
    }
    return () => { referenceRequest.current?.abort(); referenceRequest.current = null }
  }, [selected?.id, selected?.text, scope?.language, scope?.variety, scope?.explanation, scope?.explanationVariety, active])
  const playReference = async (item: DrillItemView, startSeconds?: number) => {
    if (!active || !scope || holdingAudio) return
    referenceRequest.current?.abort()
    const controller = new AbortController()
    referenceRequest.current = controller
    setSpeaking(true); setReferenceFailure(null)
    const current = () => referenceRequest.current === controller && !controller.signal.aborted && itemShowing.current === item.id
    const observer: PlaybackObserver = {
      startSeconds,
      onTime: seconds => { if (current()) setReferenceTime(seconds) },
      onReady: player => { if (current()) { referencePlayer.current = player; player?.setRate(playbackRate.current) } },
    }
    const rate = settings?.tts_rate ?? 1
    const volume = (settings?.master_volume ?? 100) * (settings?.voice_volume ?? 100) / 10000
    try {
      if (startSeconds !== undefined && reference?.itemId === item.id) {
        // Seeking retained audio must not issue a speech-generation request.
        await replaySelectionAudio(reference.audioBase64, controller.signal, () => {}, rate, volume, observer)
      } else {
        await speakSelection({ ...scope, text: item.text, aid: 'speech', referenceItem: item.id }, controller.signal, () => {}, rate, volume, {
          ...observer,
          onAudio: async spoken => {
            controller.signal.throwIfAborted()
            if (!spoken.audioBase64) throw new Error('The speech service returned no audio.')
            const inspection = await inspectDrillAudio(item.id, spoken.audioBase64, { speechAlignment: spoken.audioAlignment })
            controller.signal.throwIfAborted()
            if (current()) {
              setReference({ itemId: item.id, audioBase64: spoken.audioBase64, inspection })
              setReferenceTime(0)
            }
          },
        })
      }
    } catch (error) {
      if (current() && !(error instanceof DOMException && error.name === 'AbortError')) setReferenceFailure(error)
    } finally {
      if (referenceRequest.current === controller) { setSpeaking(false); referencePlayer.current = null }
    }
  }
  useEffect(() => { referencePlayer.current?.setRate(settings?.tts_rate ?? 1) }, [settings?.tts_rate])
  const seekReference = (seconds: number) => {
    if (holdingAudio || !selected || reference?.itemId !== selected.id) return
    setReferenceTime(seconds)
    if (speaking) referencePlayer.current?.seek(seconds)
  }
  // What is on screen right now, for late results to check themselves against.
  const itemShowing = useRef<string | null>(null)
  itemShowing.current = selected?.id ?? null

  // Pages arrive newest first, so the head of the list is the latest attempt.
  const visibleAttempts = history.attempts.filter(entry => showUnscored || (entry.comparison.reliability?.accepted !== false && entry.comparison.matchRatio !== null))
  const preview = chosenAttemptId === null && clip.preview && !removedRecordings.has(clip.preview.recordingId) ? clip.preview : null
  const previewAttempt = preview ? history.attempts.find(entry => entry.transcriptionAttemptId === preview.recordingId) : null
  const attempt = visibleAttempts.find(entry => entry.id === chosenAttemptId) ?? visibleAttempts[0] ?? null
  const audioAttempt = preview ? previewAttempt ?? null : attempt
  const attemptAudio = useAttemptAudio(selected?.id ?? null, audioAttempt)
  const shownAttemptAudio = preview && audioAttempt?.transcriptionAttemptId !== preview.recordingId ? null : attemptAudio.audio
  useEffect(() => {
    setAttemptTime(0); setPlayingAttempt(false)
    return () => { attemptPlayback.current?.abort(); attemptPlayback.current = null }
  }, [attempt?.id, active])
  const playAttempt = async (base64: string, startSeconds = 0) => {
    if (!active || holdingAudio) return
    attemptPlayback.current?.abort()
    const controller = new AbortController()
    attemptPlayback.current = controller
    setPlayingAttempt(true); setAttemptTime(startSeconds)
    try {
      await replaySelectionAudio(base64, controller.signal, () => {}, settings?.tts_rate ?? 1,
        (settings?.master_volume ?? 100) * (settings?.voice_volume ?? 100) / 10000, {
          startSeconds,
          onReady: player => { if (attemptPlayback.current === controller) attemptPlayer.current = player },
          onTime: seconds => {
            if (attemptPlayback.current === controller && !controller.signal.aborted) setAttemptTime(seconds)
          },
        })
    } catch (error) {
      if (attemptPlayback.current === controller && !controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) setFailure(error)
    } finally { if (attemptPlayback.current === controller) setPlayingAttempt(false) }
  }

  const scrubVolume = (settings?.master_volume ?? 100) * (settings?.voice_volume ?? 100) / 10000
  const referenceScrub = useAudibleScrub(reference?.itemId === selected?.id ? reference?.audioBase64 ?? null : null,
    active && !holdingAudio, speaking, scrubVolume, setReferenceFailure,
    () => { referenceRequest.current?.abort(); setSpeaking(false) })
  const attemptScrub = useAudibleScrub(shownAttemptAudio?.base64 ?? null,
    active && !holdingAudio, playingAttempt, scrubVolume, setFailure,
    () => { attemptPlayback.current?.abort(); setPlayingAttempt(false) })

  if (!creating) return <p role="status">{tr("Loading…")}</p>
  const locale = scope ? languageFor(scope.language, scope.variety) : languageFor(creating.language, creating.variety)
  const shown = reference?.itemId === selected?.id ? reference : null
  const rtl = locale?.direction === 'rtl'
  const direction = chosenDirection ?? 'ltr'
  const attemptUnavailable = !attempt ? null
    : attempt.audioPrunedAt !== null ? tr("This take's recording was removed by the storage limit.")
    : attempt.audioBytes === null ? tr("This take's recording was not kept.")
    : null

  const dock = selected && (
        <div className="drill-pane drill-dock-pane" ref={element => { panes.current.dock = element }}>
          <RecordDock starting={mic.starting} phase={phase} mode={mode} onMode={changeMode} autoDetect={autoDetect} onAutoDetect={changeAutoDetect} settings={listening} onSettings={changeListening}
            listeningStatus={mic.listeningStatus} waveSource={mic.waveSource} liveSpectrum={mic.liveSpectrum}
            onToggle={() => void mic.toggleMic()}
            onHoldStart={holdStart} onHoldEnd={holdEnd} />
        </div>
  )
  const liveTakes = [...mic.pendingRecordings, ...(mic.listeningStatus?.takes ?? [])].filter(take => !removedRecordings.has(take.recordingId))
  const queue = <TakeQueue takes={liveTakes} attempts={history.attempts}
    onRecordAgain={() => void mic.toggleMic()} recordingBusy={mic.recording || mic.transcribing} />
  const report = selected && (
      <aside className="drill-log" aria-label={tr("Attempts")} ref={element => { panes.current.report = element }}>
        {history.attempts.length > 0 && <ClearTakes disabled={deletingTakes || holdingAudio} onClear={clearTakes} />}
        <div className="drill-pane drill-attempts-pane" ref={element => { panes.current.attempts = element }}>
          {queue}
          <AttemptRows attempts={visibleAttempts} selectedId={attempt?.id} onSelect={setChosenAttemptId} rtl={rtl}
            arrivedId={arrivedId} onArrivalEnd={clearArrival}
            renderDetails={take => <AttemptInspection attempt={take} audio={attemptAudio.audio?.attemptId === take.id ? attemptAudio.audio.inspection : null}
              reference={shown?.inspection ?? null} rtl={rtl} onDelete={() => deleteTake(take)} deleting={deletingTakes || holdingAudio} />}
            footerControls={<label className="drill-unscored"><input type="checkbox" checked={showUnscored} onChange={event => setShowUnscored(event.target.checked)} />{tr("Show unscored")}</label>} />
        </div>
        {history.failure != null && <ErrorNotice as="p" error={history.failure}>{errorMessage(history.failure)}
          <button type="button" className="btn" onClick={history.retry}>{tr("Try again")}</button></ErrorNotice>}
        {history.loading && <p role="status">{tr("Loading…")}</p>}
        {!history.loading && history.attempts.length === 0 && <p>{tr("No attempts yet. Record one to compare.")}</p>}
        {history.hasMore && <button type="button" className="btn drill-more" disabled={history.loading} onClick={history.loadMore}>{tr("Show older attempts")}</button>}
      </aside>
  )
  const practice = selected && scope && (
      <main className="drill-stage">
        {loadFailure != null && <ErrorNotice as="p" error={loadFailure}>{errorMessage(loadFailure)}
          <button type="button" className="btn" onClick={() => refresh()}>{tr("Try again")}</button></ErrorNotice>}
        {visit.failure != null && <ErrorNotice as="p" error={visit.failure}>{errorMessage(visit.failure)}
          <button type="button" className="btn" onClick={visit.retry}>{tr("Try again")}</button></ErrorNotice>}
        {failure != null && <ErrorNotice as="p" error={failure}>{errorMessage(failure)}</ErrorNotice>}

        <DrillComparison comparisonAccepted={audioAttempt?.comparison.reliability?.accepted !== false} target={<DrillAnalysis item={selected} scope={scope} nativeLanguageName={settings?.native_language ?? ''}>
            {analysis => (
              <TargetMessage readAloud={false} addToDrill={false} layout="bubble" text={selected.text} segments={[]} segmentsKey={selected.id}
                translation={null} romanization={null} pronunciation={null} translateLabel={tr("Translate")}
                segmentsPending={false} lookupWords status={null} annotation={null} analysis={analysis}
                speech={null} focused={false} rtl={locale?.direction === 'rtl'} />
            )}
          </DrillAnalysis>}
          playbackSpeed={<label className="drill-playback-speed"><span>{tr('Voice speed')}</span><select className="field" aria-label={tr('Voice speed')}
            value={settings?.tts_rate ?? 1} disabled={savingPreference || !settings}
            onChange={event => void setPreference('tts_rate', Number(event.target.value))}>
            {[...new Set([0.5, 0.65, 0.8, 1, 1.2, 1.5, settings?.tts_rate ?? 1])].sort((a, b) => a - b).map(rate => <option key={rate} value={rate}>{rate}×</option>)}
          </select></label>}
          referenceFailure={referenceFailure != null ? <ErrorNotice as="div" error={referenceFailure}><strong>{tr('Reference')}</strong><p>{errorMessage(referenceFailure)}</p>
            <button type="button" className="btn" disabled={holdingAudio || speaking} onClick={() => void playReference(selected)}>{tr('Try again')}</button><ResponseDetails value={referenceFailure} /></ErrorNotice> : undefined}
          onPlayReference={() => {
            if (speaking) { referenceRequest.current?.abort(); referencePlayer.current?.stop(); setSpeaking(false) }
            else void playReference(selected, referenceTime > 0 && referenceTime < (shown?.inspection.duration ?? 0) ? referenceTime : undefined)
          }} playingReference={speaking}
          referenceNote={holdingAudio ? tr("Playback waits until the attempt is stored.") : tr("Replays reuse the saved reference; no new request is made.")}
          reference={shown?.inspection ?? null} referenceTime={referenceTime} onSeekReference={seekReference} referenceScrub={referenceScrub} attemptScrub={attemptScrub}
          attempt={shownAttemptAudio?.inspection ?? null} preview={preview} attemptTime={attemptTime}
          attemptLabel={preview ? tr("Take {value0}", { value0: preview.number }) : attempt ? tr("Attempt {value0}", { value0: String(attempt.sequence) }) : null}
          attemptFailure={clip.failure ?? attemptAudio.failure} onRetryAttempt={() => { if (clip.failure) clip.retry(); else attemptAudio.retry() }} attemptUnavailable={preview ? null : attemptUnavailable}
          onSeekAttempt={seconds => {
            if (!shownAttemptAudio || holdingAudio) return
            setAttemptTime(seconds)
            if (playingAttempt) attemptPlayer.current?.seek(seconds)
          }}
          direction={direction} onDirection={setChosenDirection} timeScale={timeScale} onTimeScale={setTimeScale} holding={holdingAudio}
          playingAttempt={playingAttempt} onPlayAttempt={() => {
            if (playingAttempt) { attemptPlayback.current?.abort(); setPlayingAttempt(false) }
            else if (shownAttemptAudio) void playAttempt(shownAttemptAudio.base64, attemptTime < shownAttemptAudio.inspection.duration ? attemptTime : 0)
          }} />


      </main>
  )

  return (
    <ReadingScopeContext value={scope ?? creating}><ReadingLanguageScope language={scope?.language ?? creating.language} variety={scope?.variety ?? creating.variety}>
    <section className="drill-page" aria-label={tr("Drill")} ref={page} style={{
      '--drill-report-width': px(reportWidth), '--drill-dock-height': px(dockHeight),
    } as CSSProperties}>
      <div className="drill-error-overlay">
          {mic.failure != null && <ErrorNotice as="div" error={mic.failure}><strong>{tr('Microphone')}</strong><p>{errorMessage(mic.failure)}</p><ResponseDetails value={mic.failure} />
            <button type="button" className="btn" disabled={mic.recording || mic.transcribing} onClick={() => void mic.toggleMic()}>{tr('Record again')}</button></ErrorNotice>}
      </div>
      <DrillLayout items={items} selectedId={selectedId} locked={holdingAudio} onAddPhrases={() => setAsking(true)}
        onSelect={id => { selectionGeneration.current++; setChosenAttemptId(null); setSelectedId(id) }}
        attempt={attempt} rtl={rtl} dock={dock} report={report} queue={queue}
        reportResize={<ResizeHandle label={tr("Resize the report column")} axis="x" grow={-1} size={reportWidth} min={220} max={900} measure={measure('report')} onResize={setReportWidth} />}
        dockResize={<ResizeHandle label={tr("Resize the recording panel")} axis="y" grow={-1} size={dockHeight} min={56} max={640} measure={measure('dock')} onResize={setDockHeight} />}
        rail={<PhraseRail items={items} selectedId={selectedId} busy={busy} locked={holdingAudio}
        onSelect={id => { selectionGeneration.current++; setChosenAttemptId(null); setSelectedId(id) }} onDelete={remove}>
        <DrillStorage active={active} onChanged={reload} />
      </PhraseRail>}>

      {practice ?? <main className="drill-stage drill-stage-alone">
        {failure != null && <ErrorNotice as="p" error={failure}>{errorMessage(failure)}</ErrorNotice>}
        {loadFailure != null
          ? <ErrorNotice as="p" error={loadFailure}>{errorMessage(loadFailure)}
            <button type="button" className="btn" onClick={() => refresh()}>{tr("Try again")}</button></ErrorNotice>
          : <div className="drill-prepare">
            <header className="drill-prepare-head">
              <h2>{tr("Nothing to practise yet")}</h2>
              <p>{tr("Add a drill target to start practising.")}</p>
              <button type="button" className="btn primary" disabled={busy || holdingAudio} onClick={() => setAsking(true)}>
                {tr("Add drill targets…")}</button>
            </header>
            <div className="drill-prepare-frame" aria-hidden="true">
              <div className="drill-prepare-reference"><span>{tr("Drill target")}</span></div>
              <div className="drill-prepare-compare">
                <div><span>{tr("Reference")}</span></div>
                <div><span>{tr("Your take")}</span></div>
              </div>
              <div className="drill-prepare-report"><span>{tr("Attempts")}</span></div>
            </div>
          </div>}
      </main>}

      </DrillLayout>

      {/* Raised over the practice columns rather than replacing them. */}
      {asking && <AddPhrases scope={creating} onAdded={async () => refresh()} onClose={() => setAsking(false)} />}
    </section>
    </ReadingLanguageScope></ReadingScopeContext>
  )
}

export default DrillPage
