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
import { clearDrillAttempts, createDrillItem, deleteDrillAttempt, deleteDrillItem, drillItems, inspectDrillAudio } from '../../platform/ipc/drill'
import type { AudioInspection, DrillAttemptView, DrillItemView, ListeningSettings } from '../../generated/contracts'
import { useDrillVisit } from './useDrillVisit'
import { useDrillAttempts } from './useDrillAttempts'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { DrillLayout } from './DrillLayout'
import { AttemptLog } from './AttemptLog'
import { AttemptInspection } from './AttemptInspection'
import { DrillComparison, type TimeDirection, type TimeScale } from './DrillComparison'
import { PhraseProgress } from './PhraseProgress'
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
  const [asking, setAsking] = useState(false)
  const savingPreference = useSettingsStore(state => state.savingPreference)
  const setPreference = useSettingsStore(state => state.setPreference)
  const [speaking, setSpeaking] = useState(false)
  const [mode, setMode] = useState<RecordMode>('auto')
  const [listening, setListening] = useState<ListeningSettings>({
    pauseMs: CONTINUOUS_RECORDING_POLICY.defaultPauseMs,
    thresholdDb: CONTINUOUS_RECORDING_POLICY.defaultThresholdDb,
    minTakeMs: CONTINUOUS_RECORDING_POLICY.defaultMinTakeMs,
    silenceTimeoutMs: CONTINUOUS_RECORDING_POLICY.defaultSilenceTimeoutMs,
  })
  // Audio runs left-to-right independently of the phrase's writing direction.
  const [chosenDirection, setChosenDirection] = useState<TimeDirection | null>(null)
  const [timeScale, setTimeScale] = useState<TimeScale>('fit')
  const [playingAttempt, setPlayingAttempt] = useState(false)
  const [attemptTime, setAttemptTime] = useState(0)
  // Every split on the page can be dragged; each size is kept for next time.
  const [railWidth, setRailWidth] = useStoredSize('drill-rail')
  const [reportWidth, setReportWidth] = useStoredSize('drill-report')
  const [dockHeight, setDockHeight] = useStoredSize('drill-dock')
  const [progressHeight, setProgressHeight] = useStoredSize('drill-progress')
  const [inspectionHeight, setInspectionHeight] = useStoredSize('drill-inspection')
  const page = useRef<HTMLElement>(null)
  const panes = useRef<Record<'dock' | 'progress' | 'inspection' | 'report', HTMLElement | null>>({ dock: null, progress: null, inspection: null, report: null })
  const measure = (name: keyof typeof panes.current) => () => {
    const element = panes.current[name]
    if (!element) throw new Error(`The ${name} pane is not on the page.`)
    return name === 'report' ? element.getBoundingClientRect().width : element.getBoundingClientRect().height
  }
  const measureRail = () => {
    const rail = page.current?.querySelector('.drill-rail')
    if (!rail) throw new Error('The phrase rail is not on the page.')
    return rail.getBoundingClientRect().width
  }
  const px = (size: number | null) => size === null ? undefined : `${Math.round(size)}px`
  const attemptPlayback = useRef<AbortController | null>(null)
  const [referenceTime, setReferenceTime] = useState(0)
  const referencePlayer = useRef<PlaybackHandle | null>(null)
  const playbackRate = useRef(settings?.tts_rate ?? 1)
  playbackRate.current = settings?.tts_rate ?? 1
  const selected = items.find(item => item.id === selectedId) ?? null
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
    const loaded = await drillItems(language)
    if (!mounted.current || request !== loading.current || showingLanguage.current !== language) return
    setItems(loaded)
    setSelectedId(current => generation === selectionGeneration.current && keep
      ? keep : loaded.some(item => item.id === current) ? current : loaded[0]?.id ?? null)
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
  useEffect(() => {
    const id = history.attempts[0]?.id ?? null
    const item = selected?.id ?? null
    if (id && newestTake.current.id && newestTake.current.item === item && newestTake.current.id !== id) setChosenAttemptId(null)
    newestTake.current = { item, id }
  }, [history.attempts[0]?.id, selected?.id])
  const visit = useDrillVisit(active, creating?.language ?? null, selected?.id ?? null)
  const owner = useMemo(() => active && visit.visitId && selected ? { kind: 'drillItem' as const, id: selected.id } : null, [active, selected?.id, visit.visitId])
  const mic = useMicRecorder({ owner, onTranscribe: () => {}, listening: mode === 'auto' ? listening : undefined })
  const phase = dockPhase({ ready: visit.visitId !== null, recording: mic.recording, transcribing: mic.transcribing })
  // The microphone and the speakers share one authority, so neither reference
  // playback nor replay runs while an attempt is being captured or stored.
  const holdingAudio = mic.recording || mic.transcribing

  const changeListening = (next: ListeningSettings) => {
    setListening(next)
    if (mode === 'auto' && mic.recording && mic.listeningStatus?.listening) mic.tune(next)
  }

  // Hold to talk: a press starts a take and letting go ends it. A press shorter
  // than the shortest take is thrown away rather than transcribed.
  const pressedAt = useRef<number | null>(null)
  const holdStart = () => {
    if (pressedAt.current !== null || phase !== 'ready') return
    pressedAt.current = Date.now()
    void mic.toggleMic()
  }
  const holdEnd = () => {
    const pressed = pressedAt.current
    if (pressed === null) return
    pressedAt.current = null
    if (!mic.recording) return
    if (Date.now() - pressed < listening.minTakeMs) mic.cancel()
    else void mic.toggleMic()
  }
  // Released before the microphone finished starting: nothing was said on purpose.
  useEffect(() => {
    if (mode === 'hold' && mic.recording && pressedAt.current === null) mic.cancel()
  }, [mode, mic.recording, mic.cancel])

  const add = async (text: string) => {
    if (!creating) return
    setBusy(true); setFailure(null)
    try {
      const item = await createDrillItem({ text, ...creating })
      await reload(item.id)
    } catch (error) { setFailure(error) } finally { setBusy(false) }
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
    if (referencePlayer.current) { referencePlayer.current.seek(seconds); setReferenceTime(seconds) }
    else void playReference(selected, seconds)
  }
  // What is on screen right now, for late results to check themselves against.
  const itemShowing = useRef<string | null>(null)
  itemShowing.current = selected?.id ?? null

  // Pages arrive newest first, so the head of the list is the latest attempt.
  const attempt = history.attempts.find(entry => entry.id === chosenAttemptId) ?? history.attempts[0] ?? null
  const attemptAudio = useAttemptAudio(selected?.id ?? null, attempt)
  useEffect(() => {
    setAttemptTime(0); setPlayingAttempt(false)
    return () => { attemptPlayback.current?.abort(); attemptPlayback.current = null }
  }, [attempt?.id, active])
  const playAttempt = async (base64: string) => {
    if (!active || holdingAudio) return
    attemptPlayback.current?.abort()
    const controller = new AbortController()
    attemptPlayback.current = controller
    setPlayingAttempt(true); setAttemptTime(0)
    try {
      await replaySelectionAudio(base64, controller.signal, () => {}, settings?.tts_rate ?? 1,
        (settings?.master_volume ?? 100) * (settings?.voice_volume ?? 100) / 10000, {
          onTime: seconds => {
            if (attemptPlayback.current === controller && !controller.signal.aborted) setAttemptTime(seconds)
          },
        })
    } catch (error) {
      if (attemptPlayback.current === controller && !controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) setFailure(error)
    } finally { if (attemptPlayback.current === controller) setPlayingAttempt(false) }
  }

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
          {mic.failure != null && <ErrorNotice as="div" error={mic.failure}><strong>{tr('Microphone')}</strong><p>{errorMessage(mic.failure)}</p><ResponseDetails value={mic.failure} />
            <button type="button" className="btn" disabled={mic.recording || mic.transcribing} onClick={() => void mic.toggleMic()}>{tr('Record again')}</button></ErrorNotice>}
          <RecordDock phase={phase} mode={mode} onMode={setMode} settings={listening} onSettings={changeListening}
            listeningStatus={mic.listeningStatus} waveSource={mic.waveSource} liveSpectrum={mic.liveSpectrum}
            onToggle={() => void mic.toggleMic()} onCancel={mode === 'auto' ? mic.discardCurrent : mic.cancel}
            onHoldStart={holdStart} onHoldEnd={holdEnd} />
        </div>
  )
  const liveTakes = [...mic.pendingRecordings, ...(mic.listeningStatus?.takes ?? [])].filter(take => !removedRecordings.has(take.recordingId))
  const queue = <TakeQueue takes={liveTakes} attempts={history.attempts} rtl={rtl}
    onRecordAgain={() => void mic.toggleMic()} recordingBusy={mic.recording || mic.transcribing}
    onSelect={setChosenAttemptId} onDelete={deleteTake} deleting={deletingTakes || holdingAudio} />
  const report = selected && (
      <aside className="drill-log" aria-label={tr("Attempts")} ref={element => { panes.current.report = element }}>
        {queue}
        {history.attempts.length > 0 && <ClearTakes disabled={deletingTakes || holdingAudio} onClear={clearTakes} />}
        {attempt && <>
          <div className="drill-pane drill-inspection-pane" ref={element => { panes.current.inspection = element }}>
            <AttemptInspection key={attempt.id} attempt={attempt} audio={attemptAudio.audio?.inspection ?? null}
              reference={shown?.inspection ?? null} rtl={rtl} onDelete={() => deleteTake(attempt)} deleting={deletingTakes || holdingAudio} />
          </div>
          <ResizeHandle label={tr("Resize the selected take")} axis="y" grow={1} size={inspectionHeight} min={48} max={1200}
            measure={measure('inspection')} onResize={setInspectionHeight} />
        </>}
        <div className="drill-pane drill-progress-pane" ref={element => { panes.current.progress = element }}>
          <PhraseProgress attempts={history.attempts} selectedId={attempt?.id} onSelect={setChosenAttemptId} rtl={rtl} />
        </div>
        {history.attempts.length > 0 && <ResizeHandle label={tr("Resize the phrase summary")} axis="y" grow={1} size={progressHeight} min={48} max={900}
          measure={measure('progress')} onResize={setProgressHeight} />}
        <div className="drill-pane drill-history-pane">
          <AttemptLog rtl={rtl} onDelete={deleteTake} deleting={deletingTakes || holdingAudio} liveTakes={liveTakes} attempts={history.attempts} loading={history.loading} hasMore={history.hasMore}
            failure={history.failure} selectedId={attempt?.id ?? null} onSelect={setChosenAttemptId}
            onLoadMore={history.loadMore} onRetry={history.retry} />
        </div>
      </aside>
  )
  const practice = selected && scope && (
      <main className="drill-stage">
        {loadFailure != null && <ErrorNotice as="p" error={loadFailure}>{errorMessage(loadFailure)}
          <button type="button" className="btn" onClick={() => refresh()}>{tr("Try again")}</button></ErrorNotice>}
        {visit.failure != null && <ErrorNotice as="p" error={visit.failure}>{errorMessage(visit.failure)}
          <button type="button" className="btn" onClick={visit.retry}>{tr("Try again")}</button></ErrorNotice>}
        {failure != null && <ErrorNotice as="p" error={failure}>{errorMessage(failure)}</ErrorNotice>}

        <DrillComparison target={<DrillAnalysis item={selected} scope={scope} nativeLanguageName={settings?.native_language ?? ''}>
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
            else void playReference(selected)
          }} playingReference={speaking}
          referenceNote={holdingAudio ? tr("Playback waits until the attempt is stored.") : tr("Replays reuse the saved reference; no new request is made.")}
          reference={shown?.inspection ?? null} referenceTime={referenceTime} onSeekReference={seekReference}
          attempt={attemptAudio.audio?.inspection ?? null} attemptTime={attemptTime}
          attemptLabel={attempt ? tr("Attempt {value0}", { value0: String(attempt.sequence) }) : null}
          attemptFailure={attemptAudio.failure} onRetryAttempt={attemptAudio.retry} attemptUnavailable={attemptUnavailable}
          direction={direction} onDirection={setChosenDirection} timeScale={timeScale} onTimeScale={setTimeScale} holding={holdingAudio}
          playingAttempt={playingAttempt} onPlayAttempt={() => {
            if (playingAttempt) { attemptPlayback.current?.abort(); setPlayingAttempt(false) }
            else if (attemptAudio.audio) void playAttempt(attemptAudio.audio.base64)
          }} />


      </main>
  )

  return (
    <ReadingScopeContext value={scope ?? creating}><ReadingLanguageScope language={scope?.language ?? creating.language} variety={scope?.variety ?? creating.variety}>
    <section className="drill-page" aria-label={tr("Drill")} ref={page} style={{
      '--drill-rail-width': px(railWidth), '--drill-report-width': px(reportWidth), '--drill-dock-height': px(dockHeight),
      '--drill-progress-height': px(progressHeight), '--drill-inspection-height': px(inspectionHeight),
    } as CSSProperties}>
      <DrillLayout items={items} selectedId={selectedId} locked={holdingAudio}
        onSelect={id => { selectionGeneration.current++; setChosenAttemptId(null); setSelectedId(id) }}
        attempt={attempt} rtl={rtl} dock={dock} report={report} queue={queue}
        progress={<PhraseProgress attempts={history.attempts} compact selectedId={attempt?.id} onSelect={setChosenAttemptId} />}
        railResize={<ResizeHandle label={tr("Resize the phrase list")} axis="x" grow={1} size={railWidth} min={160} max={640} measure={measureRail} onResize={setRailWidth} />}
        reportResize={<ResizeHandle label={tr("Resize the report column")} axis="x" grow={-1} size={reportWidth} min={220} max={900} measure={measure('report')} onResize={setReportWidth} />}
        dockResize={<ResizeHandle label={tr("Resize the recording panel")} axis="y" grow={-1} size={dockHeight} min={56} max={640} measure={measure('dock')} onResize={setDockHeight} />}
        rail={<PhraseRail items={items} selectedId={selectedId} languageTag={locale?.languageTag} busy={busy} locked={holdingAudio}
        onAdd={add} onSelect={id => { selectionGeneration.current++; setChosenAttemptId(null); setSelectedId(id) }} onDelete={remove}
        onAskForMore={() => setAsking(true)}>
        <DrillStorage active={active} onChanged={reload} />
      </PhraseRail>}>

      {practice ?? <main className="drill-stage drill-stage-alone">
        {failure != null && <ErrorNotice as="p" error={failure}>{errorMessage(failure)}</ErrorNotice>}
        {loadFailure != null
          ? <ErrorNotice as="p" error={loadFailure}>{errorMessage(loadFailure)}
            <button type="button" className="btn" onClick={() => refresh()}>{tr("Try again")}</button></ErrorNotice>
          : <p className="drill-empty">{tr("Add a phrase to start practising.")}</p>}
      </main>}

      </DrillLayout>

      {/* Raised over the practice columns rather than replacing them. */}
      {asking && <AddPhrases scope={creating} onAdded={async () => refresh()} onClose={() => setAsking(false)} />}
    </section>
    </ReadingLanguageScope></ReadingScopeContext>
  )
}

export default DrillPage
