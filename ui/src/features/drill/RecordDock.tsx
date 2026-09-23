import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { WaveformStrip } from '../../components/media/WaveformStrip'
import type { WaveSource } from '../../domain/audio/waveform'

/** Which of the four things the microphone is doing right now. */
export type DockPhase = 'preparing' | 'ready' | 'recording' | 'working'

export function dockPhase({ ready, recording, transcribing }: {
  ready: boolean; recording: boolean; transcribing: boolean
}): DockPhase {
  if (recording) return 'recording'
  if (transcribing) return 'working'
  return ready ? 'ready' : 'preparing'
}

/** The one control that starts and stops an attempt, and the state it is in.
 *
 * Capture and playback share one authority, so the dock says when playback is
 * held rather than letting a disabled button explain itself. */
export function RecordDock({ phase, waveSource, onToggle, onCancel }: {
  phase: DockPhase
  waveSource: WaveSource | null
  onToggle: () => void
  onCancel: () => void
}) {
  const tr = useI18n()
  const copy = {
    preparing: { headline: tr("Preparing the session"), detail: tr("Recording starts once the practice session is open.") },
    ready: { headline: tr("Ready to record"), detail: tr("Tap to start, tap again to stop.") },
    recording: { headline: tr("Recording"), detail: tr("Stop when you finish. Discard throws this attempt away.") },
    working: { headline: tr("Transcribing"), detail: tr("You can leave this phrase; the attempt is stored by the app.") },
  }[phase]
  const label = phase === 'recording' ? tr("Stop recording") : tr("Start recording")

  return (
    <section className="drill-dock" data-phase={phase} aria-label={tr("Record an attempt")}>
      <div className="drill-dock-row">
        <button type="button" className="drill-dock-button" aria-label={label} aria-pressed={phase === 'recording'}
          disabled={phase === 'preparing' || phase === 'working'} onClick={onToggle}>
          <ToolbarIcon name={phase === 'recording' ? 'stop' : 'mic'} size={26} />
        </button>
        {/* The phase changes without the learner acting — a transcription
            finishing, a session opening — so it is announced, not just drawn. */}
        <div className="drill-dock-copy" role="status" aria-live="polite">
          <p className="drill-dock-headline">{copy.headline}</p>
          <p className="drill-dock-detail">{copy.detail}</p>
        </div>
        {phase === 'recording' && <button type="button" className="btn" onClick={onCancel}>{tr("Discard")}</button>}
      </div>
      {waveSource && <WaveformStrip source={waveSource} />}
    </section>
  )
}
