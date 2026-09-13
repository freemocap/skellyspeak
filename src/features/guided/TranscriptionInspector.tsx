import { useEffect, useRef, useState } from 'react'
import type { TranscriptionInspectionResult } from '../../contracts'
import { DetailDialog } from '../../ui/DetailDialog'
import { cssToken } from '../../platform/css-token'

type Inspection = TranscriptionInspectionResult['inspection']
const seconds = (value: number) => `${value.toFixed(2)} s`

function Spectrogram({ data, duration }: { duration: number; data: Inspection['spectrogram'] }) {
  const [unavailable, setUnavailable] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const paint = () => {
      const element = canvas.current
      if (!element || !data.bins.length || !data.bins[0].length) return
      const context = element.getContext('2d')
      if (!context) { setUnavailable(true); return }
      element.width = 1000; element.height = data.bins[0].length
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
  }, [data, duration])
  return <>{unavailable && <p role="status">Spectrogram rendering unavailable.</p>}<canvas ref={canvas} className="inspection-spectrogram" role="img" aria-label={`Spectrogram, 0 to ${Math.round(data.maxFrequencyHz)} Hz, ${data.dbMin} to ${data.dbMax} dB`} /></>
}

export function TranscriptionInspector({ result, onClose }: { result: TranscriptionInspectionResult; onClose: () => void }) {
  const { inspection } = result
  const [selected, setSelected] = useState<number | null>(null)
  const [overlay, setOverlay] = useState(true)
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
  return <DetailDialog title="Recording inspection" onClose={onClose}>
    <section className="transcription-inspector">
      <h2>Recording inspection</h2>
      <p>Original recording · {seconds(duration)} · {inspection.sampleRate.toLocaleString()} Hz</p>
      <p className="inspection-transcript" dir="auto">{result.text || 'No transcript text.'}</p>
      <div className="inspection-row"><h3>Waveform</h3><div className="inspection-plot"><svg className="inspection-wave" viewBox="0 0 1000 80" preserveAspectRatio="none" role="img" aria-label="Recorded audio amplitude"><path d={wave} vectorEffect="non-scaling-stroke" /></svg>{bands(80)}{overlay && selectedWord && <span className="inspection-plot-word" style={{ left: `${Math.min(80, x(selectedWord.start) / 10)}%` }}><bdi>{selectedWord.word}</bdi></span>}</div></div>
      <div className="inspection-row"><h3>Spectrogram<span>{Math.round(spectrogram.maxFrequencyHz)} Hz</span><span>0 Hz</span></h3><div className="inspection-plot"><Spectrogram data={spectrogram} duration={duration} />{bands(160)}</div></div>
      <div className="inspection-row"><h3>Activity</h3><svg className="inspection-activity" viewBox="0 0 1000 24" preserveAspectRatio="none" role="img" aria-label="Detected audio activity">{activity.regions.map((region, index) => <rect key={index} x={x(region.start)} width={Math.max(1, x(region.end) - x(region.start))} height={24} />)}</svg></div>
      <div className="inspection-row"><span>Time</span><div className="inspection-axis" aria-label={`Shared time axis, 0 to ${seconds(duration)}`}>{[0, 1, 2, 3, 4].map(tick => <span key={tick}>{(duration * tick / 4).toFixed(1)} s</span>)}</div></div>
      <div className="inspection-legend"><span>{spectrogram.dbMin} dB</span><span className="inspection-heatmap-key" aria-hidden="true" /><span>{spectrogram.dbMax} dB</span><span>Intensity</span></div>
      {wordTiming.status === 'unavailable' ? <p role="status">Word timings unavailable{wordTiming.reason ? `: ${wordTiming.reason}` : '.'}</p> : <>
        <label className="inspection-word-toggle"><input type="checkbox" checked={overlay} onChange={event => setOverlay(event.target.checked)} />Word timing overlays</label>
        <div className="inspection-words" aria-label="Timed words">{wordTiming.words.map(word => <button key={word.index} aria-pressed={selected === word.index} title={`${word.word}: ${seconds(word.start)}–${seconds(word.end)}`} onFocus={() => setSelected(word.index)} onPointerEnter={() => setSelected(word.index)} onClick={() => setSelected(word.index)}><bdi>{word.word}</bdi></button>)}</div>
        {selectedWord && <p className="inspection-word-detail"><bdi>{selectedWord.word}</bdi> · {seconds(selectedWord.start)}–{seconds(selectedWord.end)}{selectedWord.clipped && ` · clipped from ${seconds(selectedWord.providerStart)}–${seconds(selectedWord.providerEnd)}`}</p>}
      </>}
      {wordTiming.unsupported.length > 0 && <section aria-label="Words without supporting activity"><h3>Words without supporting activity</h3><p>These words remain in the transcript.</p><ul>{wordTiming.unsupported.map(word => <li key={word.index}><bdi>{word.word}</bdi> · {seconds(word.providerStart)}–{seconds(word.providerEnd)} · {word.reason}</li>)}</ul></section>}
      <details><summary>Detection details</summary><p>Gaps between sampled spectral windows are unsampled intervals, not detected silence. Detected audio activity is not a guarantee of speech. This inspection describes the recording, not later text edits.</p><dl><dt>Algorithm</dt><dd>{activity.algorithm}</dd><dt>Noise floor</dt><dd>{activity.noiseFloorDbfs.toFixed(1)} dBFS</dd><dt>Activity threshold</dt><dd>{activity.thresholdDbfs.toFixed(1)} dBFS</dd><dt>Sampled spectral windows</dt><dd>{seconds(spectrogram.windowSeconds)} window · {seconds(spectrogram.frameSeconds)} hop</dd><dt>Frequency resolution</dt><dd>{spectrogram.frequencyBinHz.toFixed(1)} Hz</dd></dl>{activity.limitations.map(item => <p key={item}>{item}</p>)}<p>Recorded audio is not retained here. Only this temporary inspection is available while the conversation stays open.</p></details>
    </section>
  </DetailDialog>
}
