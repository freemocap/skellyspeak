import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { LiveRecording } from '../../components/media/LiveRecording'
import { WaveformStrip } from '../../components/media/WaveformStrip'
import type { ListeningStatus, LiveSpectrogram } from '../../generated/contracts'
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
export function RecordDock({ phase, waveSource, onToggle, onCancel, continuous, listeningStatus, liveSpectrum }: {
  liveSpectrum: LiveSpectrogram | null
  continuous: boolean
  listeningStatus: ListeningStatus | null
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
  if (continuous && (phase === 'ready' || phase === 'recording')) {
    copy.headline = phase === 'ready' ? tr("Ready to record") : listeningStatus?.speaking ? tr("Recording a take") : tr("Listening")
    copy.detail = tr("Repeat the phrase with pauses. Stop finishes the current take; queued takes keep processing.")
  }
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
          {continuous && listeningStatus && <p>{tr("Queued: {value0} · Processing: {value1}", { value0: String(listeningStatus.queued), value1: listeningStatus.processing ? '1' : '0' })}</p>}
        </div>
        {phase === 'recording' && <button type="button" className="btn" onClick={onCancel}>{continuous ? tr("Discard current take") : tr("Discard")}</button>}
      </div>
      {continuous && (waveSource || liveSpectrum) ? <LiveRecording active={phase === 'recording'} source={waveSource} spectrum={liveSpectrum ?? null} takes={listeningStatus?.takes ?? []} /> : waveSource && <WaveformStrip source={waveSource} />}
    </section>
  )
}
