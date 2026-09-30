/** Offline visual fixture for the Drill page: real native spectra, synthetic
 * attempts, take states and word timings. No microphone, IPC or AI. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { loadLanguages } from '../src/platform/ipc/tauri'
import { useSettingsStore } from '../src/state/settings/settings'
import { PREVIEW_SETTINGS } from './preview-settings'
import { TopBar } from '../src/app/shell/TopBar'
import { useNavigationStore } from '../src/state/navigation/navigation'
import { createRoot } from 'react-dom/client'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { I18nProvider } from '../src/components/localization/i18n'
import { RecordDock, type RecordMode } from '../src/features/drill/RecordDock'
import { useRecorderLayout } from '../src/components/media/useRecorderLayout'
import { AttemptInspection } from '../src/features/drill/AttemptInspection'
import { DrillComparison, type TimeDirection, type TimeScale } from '../src/features/drill/DrillComparison'
import { AttemptRows } from '../src/features/drill/AttemptRows'
import { MobileAttemptHistory } from '../src/features/drill/MobileAttemptHistory'
import { fixedSpectrumFeed } from '../src/domain/audio/spectrum-feed'
import { ClearTakes } from '../src/features/drill/ClearTakes'
import { CONTINUOUS_RECORDING_POLICY } from '../src/generated/contracts'
import { DrillLayout } from '../src/features/drill/DrillLayout'
import { PhraseRail } from '../src/features/drill/PhraseRail'
import { ResizeHandle, useStoredSize } from '../src/components/layout/ResizeHandle'
import type { AudioInspection, DrillAttemptView, DrillItemView, ListeningSettings, ListeningStatus, ListeningTake, WordComparison, WordOutcome } from '../src/generated/contracts'
import fixture from './spectrogram-fixture.json'
import '../src/styles/index.css'
import { MicrophoneSelector } from '../src/components/media/MicrophoneSelector'
import { TargetMessage } from '../src/components/reading/TargetMessage'

// Exercise the production language menu with an isolated in-memory settings writer.
mockIPC(command => {
  if (command === 'list_microphones') return { source: 'native', devices: [
    { id: 'sample', label: 'Sample microphone', isDefault: true, channels: 1, sampleRate: 48000, unavailable: null },
  ] }
  if (command === 'get_snapshot') return { languages: [
    { id: 'spanish', name: 'Spanish', nativeName: 'Español', languageTag: 'es', transcriptionLanguage: 'es', fontScale: 1, direction: 'ltr', romanization: null, defaultVariety: 'spanish-mexico', varieties: [{ id: 'spanish-mexico', name: 'Mexico', description: 'Mexico', direction: 'ltr', fontScale: 1, romanization: null, transcriptionLanguage: 'es' }] },
    { id: 'english', name: 'English', nativeName: 'English', languageTag: 'en', transcriptionLanguage: 'en', fontScale: 1, direction: 'ltr', romanization: null, defaultVariety: 'english-us', varieties: [{ id: 'english-us', name: 'United States', description: 'United States', direction: 'ltr', fontScale: 1, romanization: null, transcriptionLanguage: 'en' }] },
  ] }
  throw new Error('This offline fixture does not support native actions.')
})
await loadLanguages()
useSettingsStore.setState({
  settings: { ...PREVIEW_SETTINGS, target_variety: 'spanish-mexico', my_languages: ['spanish', 'english'] },
  selectLanguageVariety: async (language, variety) => {
    useSettingsStore.setState(state => ({ settings: { ...state.settings!, target_language: language, target_variety: variety } }))
  },
})

const params = new URLSearchParams(location.search)
const locale = params.get('locale') === 'arabic' ? 'arabic' : params.get('locale') === 'german' ? 'german' : 'english'
document.documentElement.dataset.theme = params.get('theme') === 'dark' ? 'dark' : 'light'
document.documentElement.dir = locale === 'arabic' ? 'rtl' : 'ltr'
useNavigationStore.setState({ page: 'guided', practiceView: 'drill' })
const firstVisit = params.has('first')
const [reference, spoken] = fixture as unknown as AudioInspection[]
const target = ['أنا', 'بفهم', 'الخرايط', 'القديمة', 'شوية']
const timed = (inspection: AudioInspection, words = target): AudioInspection => ({
  ...inspection,
  wordTiming: {
    status: 'available', reason: null, unsupported: [],
    words: words.map((word, index) => {
      const width = inspection.duration / words.length
      return { index, word, providerStart: index * width, providerEnd: (index + 0.9) * width, start: index * width, end: (index + 0.9) * width, clipped: false }
    }),
  },
})
const word = (text: string, kind: WordOutcome): WordComparison => kind === 'same'
  ? { kind, target: text, transcript: text, similarity: null }
  : kind === 'missing' ? { kind, target: text, transcript: null, similarity: null }
  : { kind, target: text, transcript: `${text.slice(0, -1)}ة`, similarity: 0.7 }
const outcomes: WordOutcome[][] = [
  ['same', 'substituted', 'substituted', 'substituted', 'same'],
  ['same', 'same', 'same', 'same', 'same'],
  ['same', 'same', 'substituted', 'missing', 'same'],
  ['same', 'same', 'same', 'same', 'same'],
  ['same', 'same', 'substituted', 'same', 'same'],
  ['same', 'same', 'substituted', 'same', 'missing'],
  ['same', 'same', 'substituted', 'same', 'same'],
]
const ratios = [0.72, 0.93, 0.45, 0.83, 0.48, 0.45, 0.88]
const attempts: DrillAttemptView[] = outcomes.map((kinds, index) => ({
  id: `attempt-${index + 1}`, sequence: BigInt(index + 1), visitId: null, audioBytes: 400000n, audioPrunedAt: null,
  transcriptionAttemptId: null, countedAsPractice: index % 3 !== 2, createdAt: new Date(Date.UTC(2026, 8, 23, 14, 27, index * 9)).toISOString(),
  transcript: kinds.map((kind, n) => kind === 'missing' ? '' : word(target[n], kind).transcript).join(' '),
  comparison: {
    policy: 'drill-comparison-v1', target: target.join(' '), transcript: '', normalizations: ['strip_punctuation'],
    normalizedTarget: target.join(' '), normalizedTranscript: '', edits: kinds.filter(kind => kind !== 'same').length,
    referenceGraphemes: 26, characterErrorRate: 1 - ratios[index], matchRatio: ratios[index], scriptNote: 'matches',
    words: kinds.map((kind, n) => word(target[n], kind)),
  },
} as unknown as DrillAttemptView)).reverse()

function Preview() {
  const [microphoneId, setMicrophoneId] = useState<string | null>(null)
  const [autoDetect, setAutoDetect] = useState(true)
  const [mode, setMode] = useState<RecordMode>('live')
  const [live, setLive] = useState(!firstVisit)
  const [direction, setDirection] = useState<TimeDirection>('ltr')
  // The recorder keeps its own button side and time direction, as on the page.
  const recorder = useRecorderLayout('practice', 'rtl')
  const [speed, setSpeed] = useState(1)
  const [timeScale, setTimeScale] = useState<TimeScale>('words')
  const [selected, setSelected] = useState<string | null>(null)
  const [settings, setSettings] = useState<ListeningSettings>({
    pauseMs: CONTINUOUS_RECORDING_POLICY.defaultPauseMs,
    thresholdDb: CONTINUOUS_RECORDING_POLICY.defaultThresholdDb,
    minTakeMs: CONTINUOUS_RECORDING_POLICY.defaultMinTakeMs,
    silenceTimeoutMs: CONTINUOUS_RECORDING_POLICY.defaultSilenceTimeoutMs,
  })
  const [time, setTime] = useState(0)
  const [level, setLevel] = useState(-50)
  useEffect(() => {
    const timer = setInterval(() => { setTime(t => (t + .025) % reference.duration); setLevel(l => Math.max(-62, Math.min(-18, l + (Math.random() - .45) * 8))) }, 60)
    return () => clearInterval(timer)
  }, [])
  const source = useMemo(() => {
    let offset = 0
    return { samplesPerSecond: 750, read: () => {
      if (offset >= 6750) return []
      const values = Array.from({ length: 6750 }, (_, n) => Math.sin(n * .25) * (n % 2250 < 1300 ? .5 * Math.sin(n * .017) ** 2 : .003))
      offset += values.length; return values
    } }
  }, [])
  // The same stored recording-panel height as the page, with its divider.
  const [dockHeight, setDockHeight] = useStoredSize('drill-dock')
  const dockPane = useRef<HTMLDivElement>(null)
  const takes: ListeningTake[] = [{ recordingId: 'take-8', number: 8, startSeconds: 2, endSeconds: 4, cutSeconds: 4.8, state: 'processing', failure: null }]
  const status: ListeningStatus = {
    recordingId: 'fixture', listening: true, speaking: level > -40, queued: 0, processing: true, completed: 7, failure: null, takes,
    settings, levelDb: level, noiseFloorDb: -54 + 4 * Math.sin(Date.now() / 700), thresholdDb: settings.thresholdDb, ignoredTakes: 2,
  }
  const attempt = attempts.find(entry => entry.id === selected) ?? attempts[0]
  const data = useMemo(() => ({ ...reference.spectrogram,
    frameStartSeconds: [0, 3, 6].flatMap(offset => reference.spectrogram.frameStartSeconds.map(frame => frame + offset)),
    bins: [0, 3, 6].flatMap(() => reference.spectrogram.bins),
  }), [])
  const liveSpectrum = useMemo(() => fixedSpectrumFeed({ data, endSeconds: 9 }), [data])
  const phrase: DrillItemView = { source: { kind: 'own' }, attempts: [], id: 'fixture', text: target.join(' '), language: 'arabic', variety: 'arabic-egyptian', explanation: 'english', explanationVariety: 'english-us', createdAt: attempts[0].createdAt, attemptCount: attempts.length, bestMatchRatio: .93, lastAttemptAt: attempts[0].createdAt }
  return <I18nProvider locale={locale}>
    <div className="app">
    <TopBar />
    <div className="content"><div className="page-holder"><section className="drill-page" style={{ '--drill-dock-height': dockHeight === null ? undefined : `${Math.round(dockHeight)}px` } as CSSProperties}>
      <DrillLayout onAddPhrases={() => {}} items={[phrase]} empty={false} selectedId="fixture" locked={false} onSelect={() => {}} reportResize={<div />} attempt={firstVisit ? null : attempt} rtl
        rail={<PhraseRail items={[phrase]} selectedId="fixture" busy={false} locked={false} onSelect={() => {}} onDelete={async () => {}} onAddPhrases={() => {}}>
          <p>Offline fixture; synthetic attempts. No microphone or AI.</p>
          <div className="drill-actions">{(['tap', 'hold', 'live'] as const).map(option => <button key={option} className="btn" onClick={() => setMode(option)}>Show {option}</button>)}</div>
        </PhraseRail>}
        dock={<><ResizeHandle label="Resize the recording panel" axis="y" grow={-1} size={dockHeight} min={150} max={900} measure={() => dockPane.current?.getBoundingClientRect().height ?? 0} onResize={setDockHeight} /><div className="drill-dock-pane" ref={dockPane}>        <RecordDock microphoneSelector={<MicrophoneSelector value={microphoneId} onChange={setMicrophoneId} disabled={live} />} layout={recorder} phase={live ? 'recording' : 'ready'} mode={mode} onMode={setMode} autoDetect={autoDetect} onAutoDetect={setAutoDetect} settings={settings} onSettings={setSettings}
          listeningStatus={firstVisit ? null : { ...status, listening: live }} waveSource={live ? source : null} spectrum={firstVisit ? null : liveSpectrum}
          onToggle={() => setLive(value => !value)} onHoldStart={() => setLive(true)} onHoldEnd={() => setLive(false)} /></div></>}
        // Stacked, the page shows its compact attempt strip; the full list opens from it.
        report={<MobileAttemptHistory detail={id => <AttemptInspection attempt={attempts.find(entry => entry.id === id)!} audio={spoken} reference={reference} rtl onDelete={() => {}} deleting={false} />}
          preview={openAttempt => <AttemptRows attempts={attempts} selectedId={attempt.id} onSelect={id => { setSelected(id); openAttempt(id) }} rtl />}>
      <aside className="drill-log" aria-label="Attempts">
        <ClearTakes disabled={false} onClear={() => {}} />
        <div className="drill-pane drill-attempts-pane">
          <AttemptRows attempts={attempts} selectedId={attempt.id} onSelect={setSelected} rtl renderDetails={take => <AttemptInspection attempt={take} audio={spoken} reference={reference} rtl onDelete={() => {}} deleting={false} />} />
        </div>
      </aside></MobileAttemptHistory>}>
      <main className="drill-stage">
        <DrillComparison target={<TargetMessage text="أنا بفهم الخرايط القديمة شوية." segments={[]} segmentsKey="preview"
          translation={null} romanization={null} pronunciation={null} layout="bubble" translateLabel={null}
          segmentsPending={false} lookupWords={false} status={null} annotation={null} provenance={null}
          addToDrill={false} readAloud={false} speech={null} analysis={{ pending: false, onOpen: () => {} }} focused={false} rtl />}
          playbackSpeed={<label className="drill-playback-speed"><span>Voice speed</span><select className="field" aria-label="Voice speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}>{[0.5, 0.65, 0.8, 1, 1.2, 1.5].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>}
          onPlayReference={() => {}} playingReference={false} referenceNote="Fixture"
          reference={firstVisit ? null : timed(reference)} referenceTime={time} onSeekReference={setTime} attempt={firstVisit ? null : timed(spoken, attempt.comparison.words.flatMap(word => word.transcript ? [word.transcript] : []))}
          attemptLabel={firstVisit ? null : `Attempt ${attempt.sequence}`} attemptFailure={null} onRetryAttempt={() => {}} attemptUnavailable={null}
          direction={direction} onDirection={setDirection} timeScale={timeScale} onTimeScale={setTimeScale} holding={false} playingAttempt={false} onPlayAttempt={() => {}} />
      </main>
      </DrillLayout>
    </section></div></div></div>
  </I18nProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
