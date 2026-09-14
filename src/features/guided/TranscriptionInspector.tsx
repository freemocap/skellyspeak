import { useI18n } from '../../ui/i18n'
import { useEffect, useRef, useState } from 'react'
import type { TranscriptionInspectionResult } from '../../contracts'
import { DetailDialog } from '../../ui/DetailDialog'
import { cssToken } from '../../platform/css-token'

type Inspection = TranscriptionInspectionResult['inspection']
const seconds = (value: number) => `${value.toFixed(2)} s`

function Spectrogram({ data, duration, zoom }: { duration: number; zoom: number; data: Inspection['spectrogram'] }) {
  const tr = useI18n()
  const [unavailable, setUnavailable] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const paint = () => {
      const element = canvas.current
      if (!element || !data.bins.length || !data.bins[0].length) return
      const context = element.getContext('2d')
      if (!context) { setUnavailable(true); return }
      element.width = Math.ceil(1000 * zoom); element.height = data.bins[0].length
      const rgb = (token: `--${string}`) => {
        context.fillStyle = cssToken(token); context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const stops = (['--spectrogram-low', '--spectrogram-mid', '--spectrogram-high'] as const).map(rgb)
      const pixels = context.createImageData(element.width, element.height)
      data.bins.forEach((frame, index) => {
        const left = data.frameStartSeconds[index] / duration * element.width
        const width = Math.min(data.windowSeconds, duration - data.frameStartSeconds[index]) / duration * element.width
        frame.forEach((db, frequency) => {
          const level = Math.max(0, Math.min(1, (db - data.dbMin) / (data.dbMax - data.dbMin))) * 2
          const lower = Math.min(1, Math.floor(level)); const mix = level - lower
          const color = stops[lower].map((value, channel) => Math.round(value * (1 - mix) + stops[lower + 1][channel] * mix))
          for (let pixel = Math.floor(left); pixel < Math.min(element.width, Math.ceil(left + width)); pixel++) {
            const offset = ((element.height - 1 - frequency) * element.width + pixel) * 4
            color.forEach((value, channel) => { pixels.data[offset + channel] = value })
            pixels.data[offset + 3] = 255
          }
        })
      })
      context.putImageData(pixels, 0, 0)
    }
    paint()
    const observer = new MutationObserver(paint)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [data, duration, zoom])
  return <>{unavailable && <p role="status">{tr("Spectrogram rendering unavailable.")}</p>}<canvas ref={canvas} className="inspection-spectrogram" role="img" aria-label={tr("Spectrogram, 0 to {value0} Hz, {value1} to {value2} dB", { value0: String(Math.round(data.maxFrequencyHz)), value1: String(data.dbMin), value2: String(data.dbMax) })} /></>
}

export function TranscriptionInspector({ result, onClose }: { result: TranscriptionInspectionResult; onClose: () => void }) {
  const tr = useI18n()
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
    catch { setPlaybackError(true) }
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
      <p>{tr("Original recording · ")}{seconds(duration)} · {inspection.sampleRate.toLocaleString(tr.locale)} {tr(" Hz")}</p>
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
      <div className="inspection-track-labels"><span>{tr("Waveform")}</span><span>{tr("Spectrogram")} · 0–{Math.round(spectrogram.maxFrequencyHz)}{tr(" Hz")}</span><span>{tr("Timed words")}</span></div>
      <div className="inspection-viewport" ref={viewport} dir="ltr">
      <div className="inspection-timeline" style={{ width: `${zoom * 100}%` }} onClick={event => {
        if ((event.target as HTMLElement).closest('button')) return
        const rect = event.currentTarget.getBoundingClientRect()
        seek((event.clientX - rect.left) / rect.width * duration)
      }}>
      <div className="inspection-playhead" style={{ left: `${time / duration * 100}%` }} aria-hidden="true" />
      <div className="inspection-row"><h3>{tr("Waveform")}</h3><div className="inspection-plot"><svg className="inspection-wave" viewBox="0 0 1000 80" preserveAspectRatio="none" role="img" aria-label={tr("Recorded audio amplitude")}><path d={wave} vectorEffect="non-scaling-stroke" /></svg>{bands(80)}{overlay && selectedWord && <span className="inspection-plot-word" style={{ left: `${Math.min(80, x(selectedWord.start) / 10)}%` }}><bdi>{selectedWord.word}</bdi></span>}</div></div>
      <div className="inspection-row"><h3>{tr("Spectrogram")}<span>{Math.round(spectrogram.maxFrequencyHz)} {tr(" Hz")}</span><span>{tr("0 Hz")}</span></h3><div className="inspection-plot"><Spectrogram data={spectrogram} duration={duration} zoom={zoom} />{bands(160)}</div></div>
      <div className="inspection-row"><h3>{tr("Activity")}</h3><svg className="inspection-activity" viewBox="0 0 1000 24" preserveAspectRatio="none" role="img" aria-label={tr("Detected audio activity")}>{activity.regions.map((region, index) => <rect key={index} x={x(region.start)} width={Math.max(1, x(region.end) - x(region.start))} height={24} />)}</svg></div>
      <div className="inspection-row"><span>{tr("Time")}</span><div className="inspection-axis" aria-label={tr("Shared time axis, 0 to {value0}", { value0: String(seconds(duration)) })}>{Array.from({ length: Math.ceil(zoom * 4) + 1 }, (_, tick) => <span key={tick}>{(duration * tick / Math.ceil(zoom * 4)).toFixed(1)} s</span>)}</div></div>
      <div className="inspection-token-track" aria-label={tr("Timed words")}>{wordTiming.words.map(word => <button key={word.index} aria-pressed={selected === word.index} className={time >= word.start && time < word.end ? 'inspection-token-active' : undefined} style={{ left: `${word.start / duration * 100}%`, width: `${Math.max(0.2, (word.end - word.start) / duration * 100)}%` }} title={`${word.word}: ${seconds(word.start)}–${seconds(word.end)}`} onFocus={() => setSelected(word.index)} onClick={() => { setSelected(word.index); seek(word.start) }}><bdi>{word.word}</bdi></button>)}</div>
      </div></div>
      <div className="inspection-legend"><span>{spectrogram.dbMin} {tr(" dB")}</span><span className="inspection-heatmap-key" aria-hidden="true" /><span>{spectrogram.dbMax} {tr(" dB")}</span><span>{tr("Intensity")}</span></div>
      {wordTiming.status === 'unavailable' ? <p role="status">{tr("Word timings unavailable")}{wordTiming.reason ? `: ${wordTiming.reason}` : '.'}</p> : <>
        <label className="inspection-word-toggle"><input type="checkbox" checked={overlay} onChange={event => setOverlay(event.target.checked)} />{tr("Word timing overlays")}</label>
        {selectedWord && <p className="inspection-word-detail"><bdi>{selectedWord.word}</bdi> · {seconds(selectedWord.start)}–{seconds(selectedWord.end)}{selectedWord.clipped && tr(" · clipped from {value0}–{value1}", { value0: String(seconds(selectedWord.providerStart)), value1: String(seconds(selectedWord.providerEnd)) })}</p>}
      </>}
      {selectedWord && <div className="inspection-confidence">{(() => {
        const segment = result.segments?.find(item => item.start <= selectedWord.providerStart && item.end > selectedWord.providerStart)
        return segment ? <><span>{tr("Segment confidence")}</span><dl><dt>{'avg_logprob'}</dt><dd>{segment.avg_logprob.toFixed(3)}</dd><dt>{'no_speech_prob'}</dt><dd>{segment.no_speech_prob.toFixed(3)}</dd><dt>{tr("Time")}</dt><dd>{seconds(segment.start)}–{seconds(segment.end)}</dd><dt>{tr("Token IDs")}</dt><dd>{segment.tokens?.join(', ') || '—'}</dd></dl><p dir="auto">{segment.text}</p></> : <p>{tr("Confidence unavailable.")}</p>
      })()}</div>}
      {wordTiming.unsupported.length > 0 && <section aria-label={tr("Words without supporting activity")}><h3>{tr("Words without supporting activity")}</h3><p>{tr("These words remain in the transcript.")}</p><ul>{wordTiming.unsupported.map(word => <li key={word.index}><bdi>{word.word}</bdi> · {seconds(word.providerStart)}–{seconds(word.providerEnd)} · {word.reason}</li>)}</ul></section>}
      <details><summary>{tr("Detection details")}</summary><p>{tr("Gaps between sampled spectral windows are unsampled intervals, not detected silence. Detected audio activity is not a guarantee of speech. This inspection describes the recording, not later text edits.")}</p><dl><dt>{tr("Algorithm")}</dt><dd>{activity.algorithm}</dd><dt>{tr("Noise floor")}</dt><dd>{activity.noiseFloorDbfs.toFixed(1)} {tr(" dBFS")}</dd><dt>{tr("Activity threshold")}</dt><dd>{activity.thresholdDbfs.toFixed(1)} {tr(" dBFS")}</dd><dt>{tr("Sampled spectral windows")}</dt><dd>{seconds(spectrogram.windowSeconds)} {tr(" window · ")}{seconds(spectrogram.frameSeconds)} {tr(" hop")}</dd><dt>{tr("Frequency resolution")}</dt><dd>{spectrogram.frequencyBinHz.toFixed(1)} {tr(" Hz")}</dd></dl>{activity.limitations.map(item => <p key={item}>{item}</p>)}<p>{tr("Audio and inspection remain in memory until another recording replaces them or you leave the conversation.")}</p></details>
    </section>
  </DetailDialog>
}
