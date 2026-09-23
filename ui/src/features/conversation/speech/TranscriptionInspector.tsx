import { reportFault } from '../../../platform/diagnostics/faults'
import { mediaError } from '../../../platform/audio/media-error'
import { useI18n } from '../../../components/localization/i18n'
import { useEffect, useRef, useState } from 'react'
import type { TranscriptionInspectionResult } from '../../../generated/contracts'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { Spectrogram, SpectrogramFrequencyScale } from '../../../components/media/Spectrogram'
import { ActivityTrack, DetectionDetails, TimedWordTrack, WordTimingNote, useSeconds } from '../../../components/media/InspectionTracks'

export function TranscriptionInspector({ result, onClose }: { result: TranscriptionInspectionResult; onClose: () => void }) {
  const tr = useI18n()
  const seconds = useSeconds()
  const { inspection } = result
  const [selected, setSelected] = useState<number | null>(null)
  const [overlay, setOverlay] = useState(true)
  const audio = useRef<HTMLAudioElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [audioUrl, setAudioUrl] = useState<string>()
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [follow, setFollow] = useState(true)
  const [playbackError, setPlaybackError] = useState(false)
  useEffect(() => {
    if (!result.audioBase64) return
    const bytes = Uint8Array.from(atob(result.audioBase64), value => value.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
    setAudioUrl(url)
    return () => { URL.revokeObjectURL(url) }
  }, [result.audioBase64])
  useEffect(() => {
    const element = audio.current
    return () => { element?.pause() }
  }, [audioUrl])
  useEffect(() => {
    if (!playing) return
    let frame: number
    const tick = () => {
      if (audio.current) setTime(audio.current.currentTime)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])
  useEffect(() => {
    const view = viewport.current
    if (!view || !follow) return
    const position = time / result.inspection.duration * view.scrollWidth
    if (position < view.scrollLeft || position > view.scrollLeft + view.clientWidth * 0.8) {
      view.scrollLeft = Math.max(0, position - view.clientWidth * 0.2)
    }
  }, [time, zoom, follow, result.inspection.duration])
  const seek = (value: number) => {
    const next = Math.max(0, Math.min(result.inspection.duration, value))
    if (audio.current) audio.current.currentTime = next
    setTime(next)
  }
  const togglePlayback = async () => {
    if (!audio.current) return
    if (!audio.current.paused) { audio.current.pause(); return }
    if (audio.current.ended) seek(0)
    try { await audio.current.play(); setPlaybackError(false) }
    catch (error) { setPlaybackError(true); reportFault('Recording playback', mediaError(error, 'Recording playback')) }
  }
  const { waveform, spectrogram, activity, wordTiming, duration } = inspection
  const x = (time: number) => Math.max(0, Math.min(1000, time / duration * 1000))
  const selectedWord = wordTiming.words.find(word => word.index === selected)
  const wave = waveform.min.map((low, index) => {
    const at = x((index + 0.5) * waveform.binSeconds)
    return `M${at},${40 - Math.max(-1, Math.min(1, waveform.max[index])) * 36}V${40 - Math.max(-1, Math.min(1, low)) * 36}`
  }).join(' ')
  const bands = (height: number) => <svg className="inspection-overlay" viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" aria-hidden="true">
    {overlay && wordTiming.words.map(word => <rect key={word.index} x={x(word.start)} width={Math.max(1, x(word.end) - x(word.start))} y={0} height={height} className={selected === word.index ? 'inspection-word-selected' : 'inspection-word-band'} />)}
  </svg>
  return <DetailDialog title={tr("Recording inspection")} onClose={onClose}>
    <section className="transcription-inspector">
      <h2>{tr("Recording inspection")}</h2>
      <p>{tr("Original recording · ")}{seconds(duration)} · {inspection.sampleRate.toLocaleString(tr.browserLocale)} {tr(" Hz")}</p>
      <p className="inspection-transcript" dir="auto">{result.text || tr("No transcript text.")}</p>
      <div className="inspection-transport">
        <button disabled={!audioUrl} onClick={() => void togglePlayback()}>{tr(playing ? "Pause" : "Play")}</button>
        <button onClick={() => seek(0)} aria-label={tr("Restart")}>↤</button>
        <output className="inspection-clock">{seconds(time)} / {seconds(duration)}</output>
        <label>{tr("Zoom")} <input aria-label={tr("Zoom")} type="range" min="1" max="16" step="0.5" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
        <button onClick={() => { setZoom(1); if (viewport.current) viewport.current.scrollLeft = 0 }}>{tr("Fit")}</button>
        <label><input type="checkbox" checked={follow} onChange={event => setFollow(event.target.checked)} />{tr("Follow playback")}</label>
      </div>
      {audioUrl && <audio ref={audio} src={audioUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setTime(duration) }} onTimeUpdate={event => setTime(event.currentTarget.currentTime)} onError={() => setPlaybackError(true)} />}
      {playbackError && <p role="alert">{tr("Audio playback failed.")}</p>}
      {!result.audioBase64 && <p role="status">{tr("Recording audio unavailable.")}</p>}
      <input className="inspection-scrubber" aria-label={tr("Playback position")} type="range" min="0" max={duration} step="0.01" value={time} onChange={event => seek(Number(event.target.value))} />
      <div className="inspection-track-labels"><span>{tr("Waveform")}</span><span>{tr("Spectrogram")} · {Math.round(spectrogram.minFrequencyHz)}–{Math.round(spectrogram.maxFrequencyHz)}{tr(" Hz")}</span><span>{tr("Timed words")}</span></div>
      <div className="inspection-viewport" ref={viewport} dir="ltr">
      <div className="inspection-timeline" style={{ width: `${zoom * 100}%` }} onClick={event => {
        if ((event.target as HTMLElement).closest('button')) return
        const rect = event.currentTarget.getBoundingClientRect()
        seek((event.clientX - rect.left) / rect.width * duration)
      }}>
      <div className="inspection-playhead" style={{ left: `${time / duration * 100}%` }} aria-hidden="true" />
      <div className="inspection-row"><h3>{tr("Waveform")}</h3><div className="inspection-plot"><svg className="inspection-wave" viewBox="0 0 1000 80" preserveAspectRatio="none" role="img" aria-label={tr("Recorded audio amplitude")}><path d={wave} vectorEffect="non-scaling-stroke" /></svg>{bands(80)}{overlay && selectedWord && <span className="inspection-plot-word" style={{ left: `${Math.min(80, x(selectedWord.start) / 10)}%` }}><bdi>{selectedWord.word}</bdi></span>}</div></div>
      <div className="inspection-row"><h3>{tr("Spectrogram")}</h3><div className="inspection-plot"><Spectrogram data={spectrogram} duration={duration} zoom={zoom} /><SpectrogramFrequencyScale data={spectrogram} />{bands(160)}</div></div>
      <div className="inspection-row"><h3>{tr("Activity")}</h3><ActivityTrack activity={activity} duration={duration} /></div>
      <div className="inspection-row"><span>{tr("Time")}</span><div className="inspection-axis" aria-label={tr("Shared time axis, 0 to {value0}", { value0: String(seconds(duration)) })}>{Array.from({ length: Math.ceil(zoom * 4) + 1 }, (_, tick) => <span key={tick}>{tr.number(duration * tick / Math.ceil(zoom * 4), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s</span>)}</div></div>
      <TimedWordTrack wordTiming={wordTiming} duration={duration} currentTime={time} selected={selected} onSelect={setSelected} onSeek={seek} />
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
