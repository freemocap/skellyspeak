import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { reportFault } from '../../platform/diagnostics/faults'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { onRecordingPublished } from '../../platform/audio/recording-events'
import { useMicRecorder } from '../../platform/audio/useMicRecorder'
import { replaySelectionAudio, speakSelection } from '../../platform/audio/reading-speech'
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
  const [speaking, setSpeaking] = useState(false)
  const [mode, setMode] = useState<RecordMode>('tap')
  const [listening, setListening] = useState<ListeningSettings>({
    pauseMs: CONTINUOUS_RECORDING_POLICY.defaultPauseMs,
    thresholdOffsetDb: CONTINUOUS_RECORDING_POLICY.defaultThresholdOffsetDb,
    minTakeMs: CONTINUOUS_RECORDING_POLICY.defaultMinTakeMs,
  })
  // Null follows the phrase's script; a choice the learner makes is kept.
  const [chosenDirection, setChosenDirection] = useState<TimeDirection | null>(null)
  const [timeScale, setTimeScale] = useState<TimeScale>('fit')
  const [playingAttempt, setPlayingAttempt] = useState(false)
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
  const [deletingTakes, setDeletingTakes] = useState(false)
  const removeTakes = async (run: () => Promise<unknown>) => {
    setDeletingTakes(true); setFailure(null)
    try { await run(); setChosenAttemptId(null); history.retry(); await reload(selected?.id) }
    catch (error) { setFailure(error) } finally { setDeletingTakes(false) }
  }
  const deleteTake = (take: DrillAttemptView) => void removeTakes(() => deleteDrillAttempt(take.id))
  const clearTakes = (since: Date | null) => {
    if (!selected) throw new Error('Clearing takes needs a selected phrase.')
    const item = selected.id
    void removeTakes(() => clearDrillAttempts(item, since?.toISOString() ?? null))
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
    return () => { referenceRequest.current?.abort(); referenceRequest.current = null }
  }, [selected?.id, active])
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
      onReady: player => { if (current()) referencePlayer.current = player },
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
            const inspection = await inspectDrillAudio(item.id, spoken.audioBase64)
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
  useEffect(() => () => { attemptPlayback.current?.abort(); attemptPlayback.current = null }, [attempt?.id])
  const playAttempt = async (base64: string) => {
    if (holdingAudio) return
    attemptPlayback.current?.abort()
    const controller = new AbortController()
    attemptPlayback.current = controller
    setPlayingAttempt(true)
    try {
      await replaySelectionAudio(base64, controller.signal, () => {}, settings?.tts_rate ?? 1,
        (settings?.master_volume ?? 100) * (settings?.voice_volume ?? 100) / 10000)
    } catch (error) {
      if (attemptPlayback.current === controller && !controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) setFailure(error)
    } finally { if (attemptPlayback.current === controller) setPlayingAttempt(false) }
  }

  if (!creating) return <p role="status">{tr("Loading…")}</p>
  const locale = scope ? languageFor(scope.language, scope.variety) : languageFor(creating.language, creating.variety)
  const shown = reference?.itemId === selected?.id ? reference : null
  const rtl = locale?.direction === 'rtl'
  const direction = chosenDirection ?? (rtl ? 'rtl' : 'ltr')
  const attemptUnavailable = !attempt ? null
    : attempt.audioPrunedAt !== null ? tr("This take's recording was removed by the storage limit.")
    : attempt.audioBytes === null ? tr("This take's recording was not kept.")
    : null

  const dock = selected && (
        <div className="drill-pane drill-dock-pane" ref={element => { panes.current.dock = element }}>
          <RecordDock phase={phase} mode={mode} onMode={setMode} settings={listening} onSettings={changeListening}
            listeningStatus={mic.listeningStatus} waveSource={mic.waveSource} liveSpectrum={mic.liveSpectrum}
            onToggle={() => void mic.toggleMic()} onCancel={mode === 'auto' ? mic.discardCurrent : mic.cancel}
            onHoldStart={holdStart} onHoldEnd={holdEnd} />
        </div>
  )
  const report = selected && (
      <aside className="drill-log" aria-label={tr("Attempts")} ref={element => { panes.current.report = element }}>
        {history.attempts.length > 0 && <ClearTakes disabled={deletingTakes || holdingAudio} onClear={clearTakes} />}
        <div className="drill-pane drill-progress-pane" ref={element => { panes.current.progress = element }}>
          <PhraseProgress attempts={history.attempts} />
        </div>
        {history.attempts.length > 0 && <ResizeHandle label={tr("Resize the phrase summary")} axis="y" grow={1} size={progressHeight} min={48} max={900}
          measure={measure('progress')} onResize={setProgressHeight} />}
        {attempt && <>
          <div className="drill-pane drill-inspection-pane" ref={element => { panes.current.inspection = element }}>
            <AttemptInspection key={attempt.id} attempt={attempt} audio={attemptAudio.audio?.inspection ?? null}
              reference={shown?.inspection ?? null} rtl={rtl} onDelete={() => deleteTake(attempt)} deleting={deletingTakes || holdingAudio} />
          </div>
          <ResizeHandle label={tr("Resize the selected take")} axis="y" grow={1} size={inspectionHeight} min={48} max={1200}
            measure={measure('inspection')} onResize={setInspectionHeight} />
        </>}
        <div className="drill-pane drill-history-pane">
          <AttemptLog rtl={rtl} onDelete={deleteTake} deleting={deletingTakes || holdingAudio} liveTakes={mic.listeningStatus?.takes ?? []} attempts={history.attempts} loading={history.loading} hasMore={history.hasMore}
            failure={history.failure} selectedId={attempt?.id ?? null} onSelect={setChosenAttemptId}
            onLoadMore={history.loadMore} onRetry={history.retry} />
        </div>
      </aside>
  )
  const practice = selected && scope && (
      <main className="drill-stage">
        {loadFailure != null && <p role="alert">{errorMessage(loadFailure)}
          <button type="button" className="btn" onClick={() => refresh()}>{tr("Try again")}</button></p>}
        {visit.failure != null && <p role="alert">{errorMessage(visit.failure)}
          <button type="button" className="btn" onClick={visit.retry}>{tr("Try again")}</button></p>}
        {failure != null && <p role="alert">{errorMessage(failure)}</p>}
        {mic.failure != null && <div role="alert"><strong>{tr('Microphone')}</strong><p>{errorMessage(mic.failure)}</p><ResponseDetails value={mic.failure} /></div>}
        {referenceFailure != null && <div role="alert"><strong>{tr('Reference')}</strong><p>{errorMessage(referenceFailure)}</p>
          <button type="button" className="btn" disabled={holdingAudio || speaking} onClick={() => void playReference(selected)}>{tr('Try again')}</button><ResponseDetails value={referenceFailure} /></div>}

        <DrillComparison target={<DrillAnalysis item={selected} scope={scope} nativeLanguageName={settings?.native_language ?? ''}>
            {analysis => (
              <TargetMessage layout="bubble" text={selected.text} segments={[]} segmentsKey={selected.id}
                translation={null} romanization={null} pronunciation={null} translateLabel={tr("Translate")}
                segmentsPending={false} lookupWords status={null} annotation={null} analysis={analysis}
                speech={null} focused={false} rtl={locale?.direction === 'rtl'} />
            )}
          </DrillAnalysis>}
          onPlayReference={() => void playReference(selected)} playingReference={speaking}
          referenceNote={holdingAudio ? tr("Playback waits until the attempt is stored.") : tr("Replays reuse the saved reference; no new request is made.")}
          reference={shown?.inspection ?? null} referenceTime={referenceTime} onSeekReference={seekReference}
          attempt={attemptAudio.audio?.inspection ?? null}
          attemptLabel={attempt ? tr("Attempt {value0}", { value0: String(attempt.sequence) }) : null}
          attemptFailure={attemptAudio.failure} onRetryAttempt={attemptAudio.retry} attemptUnavailable={attemptUnavailable}
          direction={direction} onDirection={setChosenDirection} timeScale={timeScale} onTimeScale={setTimeScale} holding={holdingAudio}
          playingAttempt={playingAttempt} onPlayAttempt={() => { if (attemptAudio.audio) void playAttempt(attemptAudio.audio.base64) }} />


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
        attempt={attempt} rtl={rtl} dock={dock} report={report}
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
        {failure != null && <p role="alert">{errorMessage(failure)}</p>}
        {loadFailure != null
          ? <p role="alert">{errorMessage(loadFailure)}
            <button type="button" className="btn" onClick={() => refresh()}>{tr("Try again")}</button></p>
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
