import type { AudioInspection } from '../../generated/contracts'
import { ToolbarIcon } from '../controls/ToolbarIcon'
import { useI18n } from '../localization/i18n'
import { PlaybackProgress } from './PlaybackProgress'
import { RecordingTrack } from './RecordingTrack'
import type { RecordingPlayback } from './useRecordingPlayback'

/** One recording inspected inside its message bubble, drawn as Practice draws a
 * recording: the same track (spectrogram, words laid over it, play cursor) under
 * the same progress bar. The message's own Play drives `playback`; `onExpand`
 * opens the full Recording inspection dialog. */
export function CompactInspection({ inspection, playback, enabled, onExpand }: {
  inspection: AudioInspection
  playback: RecordingPlayback
  /** False while the microphone holds the speakers. */
  enabled: boolean
  onExpand: () => void
}) {
  const tr = useI18n()
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation()
  const seek = enabled ? playback.seek : undefined
  return <section className="compact-inspection" aria-label={tr("Recording inspection")} dir="ltr" onClick={stop} onDoubleClick={stop}>
    <div className="compact-inspection-head">
      <PlaybackProgress time={playback.time} duration={inspection.duration} direction="ltr" label={tr("Playback position")}
        onSeek={seek} scrub={playback.scrub} />
      <button type="button" className="message-tools-icon" aria-label={tr("Recording inspection")} title={tr("Recording inspection")}
        aria-haspopup="dialog" onClick={onExpand}><ToolbarIcon name="expand" /></button>
    </div>
    <div className="compact-inspection-track">
      <RecordingTrack spectrogram={inspection.spectrogram} duration={inspection.duration} sourceDuration={inspection.duration} scale={undefined} mapTime={undefined}
        words={inspection.wordTiming} outcomes={undefined} time={playback.time} direction="ltr" label={tr("Recording inspection")}
        onSeek={seek} onWordSeek={seek} scrub={playback.scrub} style={undefined} plotRef={undefined} attempt={false} />
    </div>
  </section>
}
