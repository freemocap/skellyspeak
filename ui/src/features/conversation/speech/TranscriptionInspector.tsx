import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'
import { useEffect, useRef, useState } from 'react'
import type { TranscriptionInspectionResult } from '../../../generated/contracts'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { Spectrogram, SpectrogramFrequencyScale } from '../../../components/media/Spectrogram'
import { ActivityTrack, DetectionDetails, StoredWaveform, TimeAxis, TimedWords, WordTimingNote, useSeconds } from '../../../components/media/InspectionTracks'
import { PlaybackCursor } from '../../../components/media/PlaybackCursor'
import { PlaybackProgress } from '../../../components/media/PlaybackProgress'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useRecordingPlayback, type RecordingPlayback } from '../../../components/media/useRecordingPlayback'

/** The full analysis of one chat recording. Its plots, words, cursor, time axis
 * and transport are the same parts Practice's comparison draws with; only the
 * zoomed, scrollable timeline is particular to this dialog. */
export function TranscriptionInspector({ result, rate, volume, enabled, onClose, playback: suppliedPlayback }: {
  result: TranscriptionInspectionResult
  rate: number
  volume: number
  /** False while the microphone holds the speakers. */
  enabled: boolean
  onClose: () => void
  playback?: RecordingPlayback
}) {
  const tr = useI18n()
  const seconds = useSeconds()
  const { inspection } = result
  const { waveform, spectrogram, activity, wordTiming, duration } = inspection
  const [selected, setSelected] = useState<number | null>(null)
  const [overlay, setOverlay] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [follow, setFollow] = useState(true)
  const [playbackError, setPlaybackError] = useState<unknown>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const localPlayback = useRecordingPlayback({ audio: suppliedPlayback ? null : result.audioBase64 || null, duration, enabled, rate, volume, onError: setPlaybackError })
  const playback = suppliedPlayback ?? localPlayback
  const { time } = playback
  useEffect(() => {
    const view = viewport.current
    if (!view || !follow) return
    const position = time / duration * view.scrollWidth
    if (position < view.scrollLeft || position > view.scrollLeft + view.clientWidth * 0.8) {
      view.scrollLeft = Math.max(0, position - view.clientWidth * 0.2)
    }
  }, [time, zoom, follow, duration])
  const selectedWord = wordTiming.words.find(word => word.index === selected)
  const hasAudio = Boolean(result.audioBase64)
  const cursor = (label: string) => <PlaybackCursor time={time} duration={duration} direction="ltr" label={label}
    onSeek={hasAudio && enabled ? playback.seek : undefined} onScrubStart={playback.scrub.start} onScrub={playback.scrub.move} onScrubEnd={playback.scrub.end} />
  const words = overlay && <TimedWords placement="overlay" labels={false} timing={wordTiming} duration={duration} selected={selected} />
  return <DetailDialog title={tr("Recording inspection")} onClose={onClose}>
    <section className="transcription-inspector">
      <h2>{tr("Recording inspection")}</h2>
      <p>{tr("Original recording · ")}{seconds(duration)} · {inspection.sampleRate.toLocaleString(tr.browserLocale)} {tr(" Hz")}</p>
      <p className="inspection-transcript" dir="auto">{result.text || tr("No transcript text.")}</p>
      <div className="inspection-transport">
        <button type="button" className="btn" disabled={!hasAudio || !enabled} aria-label={tr(playback.preparing ? "Cancel speech preparation" : playback.playing ? "Pause" : "Play")} onClick={playback.toggle}>
          {playback.preparing ? <span className="activity-spinner" aria-hidden="true" /> : <ToolbarIcon name={playback.playing ? 'pause' : 'play'} size={14} />}{tr(playback.preparing ? "Cancel" : playback.playing ? "Pause" : "Play")}
        </button>
        <button type="button" className="btn" disabled={!hasAudio} onClick={() => playback.seek(0)} aria-label={tr("Restart")}>↤</button>
        <PlaybackProgress time={time} duration={duration} direction="ltr" label={tr("Playback position")}
          onSeek={hasAudio && enabled ? playback.seek : undefined} scrub={playback.scrub} />
        <label>{tr("Zoom")} <input aria-label={tr("Zoom")} type="range" min="1" max="16" step="0.5" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
        <button type="button" className="btn" onClick={() => { setZoom(1); if (viewport.current) viewport.current.scrollLeft = 0 }}>{tr("Fit")}</button>
        <label><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} />{tr("Follow playback")}</label>
      </div>
      {playbackError != null && <ErrorNotice as="p" error={playbackError}>{tr("Audio playback failed.")}</ErrorNotice>}
      {!hasAudio && <p role="status">{tr("Recording audio unavailable.")}</p>}
      <div className="inspection-track-labels"><span>{tr("Waveform")}</span><span>{tr("Spectrogram")} · {Math.round(spectrogram.minFrequencyHz)}–{Math.round(spectrogram.maxFrequencyHz)}{tr(" Hz")}</span><span>{tr("Timed words")}</span></div>
      <div className="inspection-viewport" ref={viewport} dir="ltr">
      <div className="inspection-timeline" style={{ width: `${zoom * 100}%` }}>
      <div className="inspection-row"><h3>{tr("Waveform")}</h3><div className="inspection-plot"><StoredWaveform waveform={waveform} duration={duration} />{words}{cursor(tr("Waveform"))}</div></div>
      <div className="inspection-row"><h3>{tr("Spectrogram")}</h3><div className="inspection-plot"><Spectrogram data={spectrogram} duration={duration} zoom={zoom} /><SpectrogramFrequencyScale data={spectrogram} />{words}{cursor(tr("Spectrogram"))}</div></div>
      <div className="inspection-row"><h3>{tr("Activity")}</h3><ActivityTrack activity={activity} duration={duration} /></div>
      <div className="inspection-row"><span>{tr("Time")}</span><TimeAxis span={duration} visibleSpan={duration / zoom} /></div>
      <TimedWords placement="track" timing={wordTiming} duration={duration} currentTime={time} selected={selected} onSelect={setSelected} onSeek={hasAudio && enabled ? playback.seek : undefined} />
      </div></div>
      <div className="inspection-legend"><span>{spectrogram.dbMin} {tr(" dB")}</span><span className="inspection-heatmap-key" aria-hidden="true" /><span>{spectrogram.dbMax} {tr(" dB")}</span><span>{tr("Intensity")}</span></div>
      {wordTiming.status === 'unavailable' ? <WordTimingNote wordTiming={wordTiming} /> : <>
        <label className="inspection-word-toggle"><input type="checkbox" checked={overlay} onChange={event => setOverlay(event.target.checked)} />{tr("Word timing overlays")}</label>
        {selectedWord && <p className="inspection-word-detail"><bdi>{selectedWord.word}</bdi> · {seconds(selectedWord.start)}–{seconds(selectedWord.end)}{selectedWord.clipped && tr(" · clipped from {value0}–{value1}", { value0: String(seconds(selectedWord.providerStart)), value1: String(seconds(selectedWord.providerEnd)) })}</p>}
      </>}
      {result.diagnostics != null && <details><summary>{tr("Diagnostics")}</summary><pre>{JSON.stringify(result.diagnostics, null, 2)}</pre></details>}
      {wordTiming.unsupported.length > 0 && <section aria-label={tr("Words without supporting activity")}><h3>{tr("Words without supporting activity")}</h3><p>{tr("These words remain in the transcript.")}</p><ul>{wordTiming.unsupported.map(word => <li key={word.index}><bdi>{word.word}</bdi> · {seconds(word.providerStart)}–{seconds(word.providerEnd)} · {word.reason}</li>)}</ul></section>}
      <DetectionDetails activity={activity} spectrogram={spectrogram}>
        <p>{tr("Audio and inspection remain in memory until another recording replaces them or you leave the conversation.")}</p>
      </DetectionDetails>
    </section>
  </DetailDialog>
}
