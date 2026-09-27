import { PlaybackCursor } from './PlaybackCursor'
import { useSeconds } from '../../components/media/InspectionTracks'

/** Uses the same visual time map and scrub controller as the spectrogram cursor. */
export function PlaybackProgress({ time, duration, displayDuration = duration, mapTime, direction, label, onSeek, scrub }: {
  time: number; duration: number; displayDuration?: number; mapTime?: ((time: number) => number) | null
  direction: 'ltr' | 'rtl'; label: string; onSeek?: (time: number) => void
  scrub?: { start: (time: number, timestamp?: number) => void; move: (time: number, timestamp?: number) => void; end: () => void }
}) {
  const seconds = useSeconds()
  const fraction = displayDuration > 0 ? Math.max(0, Math.min(1, (mapTime ? mapTime(time) : time) / displayDuration)) : 0
  return <div className="drill-playback-progress">
    <div className="drill-playback-progress-track" data-time={direction}>
      <span className="drill-playback-progress-fill" style={{ width: `${fraction * 100}%` }} />
      <PlaybackCursor time={time} duration={duration} displayDuration={Math.max(displayDuration, 0.001)} mapTime={mapTime} direction={direction} label={label}
        onSeek={onSeek} onScrubStart={scrub?.start} onScrub={scrub?.move} onScrubEnd={scrub?.end} />
    </div>
    <span className="drill-playback-progress-time" dir="ltr" aria-hidden="true">{seconds(Math.max(0, Math.min(time, duration)))} / {seconds(duration)}</span>
  </div>
}
