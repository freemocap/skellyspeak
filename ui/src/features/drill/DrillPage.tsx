import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { reportFault } from '../../platform/diagnostics/faults'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { onRecordingPublished } from '../../platform/audio/recording-events'
import { useMicRecorder } from '../../platform/audio/useMicRecorder'
import { speakSelection } from '../../platform/audio/reading-speech'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { TargetMessage } from '../../components/reading/TargetMessage'
import { ReadingLanguageScope } from '../../components/reading/ReadingLanguageScope'
import { ReadingScopeContext } from '../../components/reading/ReadingContext'
import { languageFor } from '../../platform/ipc/tauri'
import { useSettingsStore } from '../../state/settings/settings'
import { createDrillItem, deleteDrillItem, drillItems, inspectDrillAudio } from '../../platform/ipc/drill'
import type { AudioInspection, DrillItemView } from '../../generated/contracts'
import { useDrillVisit } from './useDrillVisit'
import { useDrillAttempts } from './useDrillAttempts'
import { AttemptLog } from './AttemptLog'
import { AttemptInspection } from './AttemptInspection'
import { DrillStorage } from './DrillStorage'
import { DrillAnalysis } from './DrillAnalysis'
import { PhraseRail } from './PhraseRail'
import { AddPhrases } from './AddPhrases'
import { RecordDock, dockPhase } from './RecordDock'

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
  const [reference, setReference] = useState<Reference | null>(null)
  // Which attempt the panel is showing. Nothing chosen means the newest one, so
  // a fresh attempt takes the panel without the learner asking.
  const [chosenAttemptId, setChosenAttemptId] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [speaking, setSpeaking] = useState(false)
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
  const mic = useMicRecorder({ owner, onTranscribe: () => {} })
  const phase = dockPhase({ ready: visit.visitId !== null, recording: mic.recording, transcribing: mic.transcribing })
  // The microphone and the speakers share one authority, so neither reference
  // playback nor replay runs while an attempt is being captured or stored.
  const holdingAudio = mic.recording || mic.transcribing

  const add = async (text: string) => {
    if (!creating) return
    setBusy(true); setFailure(null)
    try {
      const item = await createDrillItem({ text, ...creating })
      await reload(item.id)
    } catch (error) { setFailure(error) } finally { setBusy(false) }
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
    setSpeaking(false); setFailure(null)
    return () => { referenceRequest.current?.abort(); referenceRequest.current = null }
  }, [selected?.id, active])
  const playReference = async (item: DrillItemView) => {
    if (!active || !scope || holdingAudio) return
    setSpeaking(true); setFailure(null)
    referenceRequest.current?.abort()
    const controller = new AbortController()
    referenceRequest.current = controller
    try {
      const spoken = await speakSelection({ ...scope, text: item.text, aid: 'speech', referenceItem: item.id }, controller.signal, () => {},
        settings?.tts_rate ?? 1, (settings?.master_volume ?? 100) * (settings?.voice_volume ?? 100) / 10000)
      if (!spoken.audioBase64) return
      controller.signal.throwIfAborted()
      const inspection = await inspectDrillAudio(item.id, spoken.audioBase64)
      controller.signal.throwIfAborted()
      // The phrase may have changed while the speech was in flight; a reference
      // belongs to the phrase that asked for it, or to nothing.
      setReference(current => item.id === itemShowing.current ? { itemId: item.id, audioBase64: spoken.audioBase64!, inspection } : current)
    } catch (error) {
      if (referenceRequest.current === controller && !controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) setFailure(error)
    } finally { if (referenceRequest.current === controller) setSpeaking(false) }
  }
  // What is on screen right now, for late results to check themselves against.
  const itemShowing = useRef<string | null>(null)
  itemShowing.current = selected?.id ?? null

  if (!creating) return <p role="status">{tr("Loading…")}</p>
  const locale = scope ? languageFor(scope.language, scope.variety) : languageFor(creating.language, creating.variety)
  const shown = reference?.itemId === selected?.id ? reference : null
  // Pages arrive newest first, so the head of the list is the latest attempt.
  const attempt = history.attempts.find(entry => entry.id === chosenAttemptId) ?? history.attempts[0] ?? null

  const practice = selected && scope && (
    <ReadingScopeContext value={scope}><ReadingLanguageScope language={scope.language} variety={scope.variety}>
      <main className="drill-stage">
        {loadFailure != null && <p role="alert">{errorMessage(loadFailure)}
          <button type="button" className="btn" onClick={() => refresh()}>{tr("Try again")}</button></p>}
        {visit.failure != null && <p role="alert">{errorMessage(visit.failure)}
          <button type="button" className="btn" onClick={visit.retry}>{tr("Try again")}</button></p>}
        {failure != null && <p role="alert">{errorMessage(failure)}</p>}

        <div className="drill-target">
          <DrillAnalysis item={selected} scope={scope} nativeLanguageName={settings?.native_language ?? ''}>
            {analysis => (
              <TargetMessage layout="passage" text={selected.text} segments={[]} segmentsKey={selected.id}
                translation={null} romanization={null} pronunciation={null} translateLabel={tr("Translate")}
                segmentsPending={false} lookupWords status={null} annotation={null} analysis={analysis}
                speech={null} focused={false} rtl={locale?.direction === 'rtl'} />
            )}
          </DrillAnalysis>
          <div className="drill-actions">
            <button type="button" className="btn" disabled={speaking || holdingAudio} onClick={() => void playReference(selected)}>
              <ToolbarIcon name="play" size={15} />{tr(speaking ? "Playing…" : "Hear it")}
            </button>
            <span className="drill-actions-note">{holdingAudio
              ? tr("Playback waits until the attempt is stored.")
              : tr("Replays reuse the saved reference; no new request is made.")}</span>
          </div>
        </div>

        <RecordDock phase={phase} waveSource={mic.waveSource} onToggle={() => void mic.toggleMic()} onCancel={mic.cancel} />

        {attempt && <AttemptInspection key={attempt.id} item={selected} attempt={attempt}
          reference={shown?.inspection ?? null} holding={holdingAudio} />}
      </main>

      <aside className="drill-log" aria-label={tr("Attempts")}>
        <AttemptLog attempts={history.attempts} loading={history.loading} hasMore={history.hasMore}
          failure={history.failure} selectedId={attempt?.id ?? null} onSelect={setChosenAttemptId}
          onLoadMore={history.loadMore} onRetry={history.retry} />
      </aside>
    </ReadingLanguageScope></ReadingScopeContext>
  )

  return (
    <section className="drill-page" aria-label={tr("Drill")}>
      <PhraseRail items={items} selectedId={selectedId} languageTag={locale?.languageTag} busy={busy} locked={holdingAudio}
        onAdd={add} onSelect={id => { selectionGeneration.current++; setChosenAttemptId(null); setSelectedId(id) }} onDelete={remove}
        onAskForMore={() => setAsking(true)}>
        <DrillStorage active={active} onChanged={reload} />
      </PhraseRail>

      {asking
        ? <main className="drill-stage">
          <AddPhrases scope={creating} onAdded={async () => refresh()} onClose={() => setAsking(false)} />
        </main>
        : practice ?? <main className="drill-stage">
        {failure != null && <p role="alert">{errorMessage(failure)}</p>}
        {loadFailure != null
          ? <p role="alert">{errorMessage(loadFailure)}
            <button type="button" className="btn" onClick={() => refresh()}>{tr("Try again")}</button></p>
          : <p className="drill-empty">{tr("Add a phrase to start practising.")}</p>}
      </main>}
    </section>
  )
}

export default DrillPage
