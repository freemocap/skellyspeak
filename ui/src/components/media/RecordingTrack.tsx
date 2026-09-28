import type { CSSProperties, Ref } from 'react'
import type { InspectionSpectrogram, InspectionWordTiming } from '../../generated/contracts'
import type { WordMatch } from '../../domain/audio/word-alignment'
import { TimedWords } from './InspectionTracks'
import { PlaybackCursor } from './PlaybackCursor'
import { Spectrogram, SpectrogramFrequencyScale, type SpectrogramScale } from './Spectrogram'
import type { AudibleScrub } from './useAudibleScrub'

/** One recording's plot: the spectrogram with its frequency scale, the timed
 * words laid over it, and the play cursor. Practice's reference and attempt and
 * a message bubble's inspector all draw a recording with this. `duration` is
 * the displayed span; `sourceDuration` is the audio's own length, which differs
 * only while `mapTime` warps the display. */
export function RecordingTrack({ spectrogram, duration, sourceDuration, scale, mapTime, words, outcomes, time, direction, label, onSeek, onWordSeek, scrub, style, plotRef, attempt }: {
  spectrogram: InspectionSpectrogram
  duration: number
  sourceDuration: number
  scale: SpectrogramScale | undefined
  mapTime: ((seconds: number) => number) | undefined
  /** Null hides the word labels while keeping the measured plot. */
  words: InspectionWordTiming | null
  /** How each word matched a comparison; undefined for a recording shown alone. */
  outcomes: WordMatch[] | undefined
  time: number
  direction: 'ltr' | 'rtl'
  label: string
  onSeek: ((seconds: number) => void) | undefined
  onWordSeek: ((seconds: number) => void) | undefined
  scrub: AudibleScrub | undefined
  style: CSSProperties | undefined
  plotRef: Ref<HTMLDivElement> | undefined
  /** Marks the plot that receives a newly arriving attempt. */
  attempt: boolean
}) {
  return <div className="inspection-plot" data-attempt-spectrum={attempt ? '' : undefined} ref={plotRef} style={style}>
    <Spectrogram data={spectrogram} duration={duration} mapTime={mapTime} zoom={1} scale={scale} />
    <SpectrogramFrequencyScale data={spectrogram} count={3} />
    {words && <TimedWords placement="overlay" timing={words} duration={duration} outcomes={outcomes} mapTime={mapTime} onSeek={onWordSeek} />}
    <PlaybackCursor time={time} duration={sourceDuration} displayDuration={duration} mapTime={mapTime} direction={direction} label={label}
      onScrubStart={scrub?.start} onScrub={scrub?.move} onScrubEnd={scrub?.end} onSeek={onSeek} />
  </div>
}
