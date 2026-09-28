/** Offline fixture: the production spectrogram canvas over two real analyses,
 * shown the way Drill will pair a reference with an attempt. The data comes
 * from the native analysis (see the fixture's regeneration test); nothing here
 * recomputes it. No AI, audio or app state. */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { TranscriptionInspector } from '../src/features/conversation/speech/TranscriptionInspector'
import { I18nProvider } from '../src/components/localization/i18n'
import { Spectrogram, SpectrogramFrequencyScale, sharedScale } from '../src/components/media/Spectrogram'
import { TimeAxis } from '../src/components/media/InspectionTracks'
import { CompactInspection } from '../src/components/media/CompactInspection'
import { useRecordingPlayback } from '../src/components/media/useRecordingPlayback'
import type { AudioInspection } from '../src/generated/contracts'
import fixture from './spectrogram-fixture.json'
import '../src/styles/index.css'

const inspections = fixture as unknown as AudioInspection[]
// Both panels share one time span and one dB window, so height means the same
// frequency and brightness means the same level in each.
const duration = Math.max(...inspections.map(item => item.duration))
const scale = sharedScale(inspections.map(item => item.spectrogram))


function Panel({ inspection }: { inspection: AudioInspection }) {
  const { spectrogram } = inspection
  return (
    <section style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', marginBlockEnd: 'var(--space-4)' }}>
      <strong style={{ width: '6rem', fontSize: 'var(--type-meta)' }}>{inspection.recordingId}</strong>
      <div className="inspection-plot" style={{ width: `${inspection.duration / duration * 100}%` }}>
        <Spectrogram data={spectrogram} duration={inspection.duration} zoom={1} scale={scale} />
        <SpectrogramFrequencyScale data={spectrogram} />
      </div>
    </section>
  )
}

/** The bubble inspector over the same analysis, with nothing to play. */
function PreviewInspection() {
  const playback = useRecordingPlayback({ audio: null, duration: inspections[0].duration, enabled: false, rate: 1, volume: 1, onError: error => { throw error } })
  return <CompactInspection inspection={inspections[0]} playback={playback} enabled={false} onExpand={() => {}} />
}

/** Chat's own recording inspector, over the same analysis. */
function ChatInspector() {
  const [open, setOpen] = useState(false)
  return <>
    <button className="btn" onClick={() => setOpen(true)}>Open the Chat recording inspector</button>
    {open && <TranscriptionInspector rate={1} volume={1} enabled onClose={() => setOpen(false)} result={{
      text: 'Quisiera un café, por favor.', audioBase64: '', diagnostics: null, inspection: inspections[0],
    }} />}
  </>
}

createRoot(document.getElementById('root')!).render(
  <I18nProvider locale="english">
    <main className="inspection-timeline" style={{ padding: 'var(--space-6)' }}>
      <h2>Paired recordings, one mel axis and one colour scale</h2>
      <p>
        {inspections[0].spectrogram.bands.length} mel bands ·{' '}
        {Math.round(inspections[0].spectrogram.minFrequencyHz)}–
        {Math.round(inspections[0].spectrogram.maxFrequencyHz)} Hz ·{' '}
        {inspections[0].spectrogram.melScale} · {inspections[0].spectrogram.normalization} ·{' '}
        {inspections[0].spectrogram.dbReference}
      </p>
      {inspections.map(inspection => <Panel key={inspection.recordingId} inspection={inspection} />)}
      <ChatInspector />
      <div className="inspection-legend">
        <span>{scale.dbMin} dB</span>
        <span className="inspection-heatmap-key" aria-hidden="true" />
        <span>{scale.dbMax} dB</span>
        <span>Intensity</span>
      </div>
      <div className="inspection-row">
        <span>Time</span>
        <TimeAxis span={duration} />
      </div>
      <h2>The same recording inside its chat bubble</h2>
      <div className="msg chat-message me with-actions inspecting" style={{ maxWidth: '36rem' }}>
        <span className="target-text">Quisiera un café, por favor.</span>
        <PreviewInspection />
      </div>
    </main>
  </I18nProvider>,
)
