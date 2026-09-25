import { MarioCoinReference } from './MarioCoinReference'
import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import { POP_SOUNDS, renderPops, type PopSound } from './pop-sounds'
import '../src/styles/index.css'
import './xp-pop-preview.css'

function Preview() {
  const [stopSignal, setStopSignal] = useState(0)
  const [count, setCount] = useState(12)
  const [durationMs, setDurationMs] = useState(100)
  const [intervalMs, setIntervalMs] = useState(100)
  const [volume, setVolume] = useState(.35)
  const [playing, setPlaying] = useState<PopSound | null>(null)
  const [error, setError] = useState('')
  const audio = useRef<AudioContext | null>(null)
  const source = useRef<AudioBufferSourceNode | null>(null)
  const gain = useRef<GainNode | null>(null)
  const generation = useRef(0)
  const stop = () => { setStopSignal(value => value + 1); generation.current++; source.current?.stop(); source.current = null; setPlaying(null) }
  useEffect(() => { if (gain.current) gain.current.gain.value = volume }, [volume])
  useEffect(() => {
    const hide = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', hide)
    return () => { document.removeEventListener('visibilitychange', hide); generation.current++; source.current?.stop(); void audio.current?.close() }
  }, [])
  async function play(kind: PopSound, repetitions: number) {
    stop(); setError('')
    const ticket = generation.current
    try {
      const context = audio.current ??= new AudioContext()
      if (!gain.current) { gain.current = context.createGain(); gain.current.connect(context.destination) }
      gain.current.gain.value = volume
      await context.resume()
      if (ticket !== generation.current) return
      const samples = renderPops(kind, repetitions, context.sampleRate, intervalMs)
      const buffer = context.createBuffer(1, samples.length, context.sampleRate)
      buffer.getChannelData(0).set(samples)
      const node = context.createBufferSource()
      node.buffer = buffer; node.connect(gain.current); source.current = node
      node.onended = () => { node.disconnect(); if (source.current === node) { source.current = null; setPlaying(null) } }
      setPlaying(kind); node.start()
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <main className="pop-preview">
    <section className="pop-panel" aria-label="XP sound comparison">
      <header><h1>XP sounds</h1><button className="btn" onClick={stop}>Stop</button></header>
      <div className="pop-controls">
        <label>XP count<input className="field" aria-label="XP count" type="number" min={1} max={32} value={count} onChange={event => { const n = Number(event.target.value); if (Number.isInteger(n) && n >= 1 && n <= 32) { stop(); setCount(n) } }} /></label>
        <label title="Fits the entire recording into this duration; speed and pitch change together">Sound duration · {durationMs} ms<input aria-label="Sound duration" type="range" min={80} max={1000} step={10} value={durationMs} onChange={event => { stop(); setDurationMs(Number(event.target.value)) }} /></label>
        <label title="Time between the start of each sound">Interval · {intervalMs} ms<input aria-label="Interval" type="range" min={40} max={1000} step={10} value={intervalMs} onChange={event => { stop(); setIntervalMs(Number(event.target.value)) }} /></label>
        <label>Volume · {Math.round(volume * 100)}%<input aria-label="Volume" type="range" min={0} max={100} value={volume * 100} onChange={event => setVolume(Number(event.target.value) / 100)} /></label>
      </div>
      <MarioCoinReference durationMs={durationMs} stopSignal={stopSignal} count={count} intervalMs={intervalMs} volume={volume} />
      <details><summary>Synthetic comparisons</summary><div className="pop-options">{Object.entries(POP_SOUNDS).map(([key, label]) => <div className="sound-choice" key={key} data-playing={playing === key}><strong>{label}</strong><button className="btn" aria-label={`Play ${label} once`} onClick={() => void play(key as PopSound, 1)}>▶ Once</button><button className="btn" aria-label={`Play ${count} XP with ${label}`} onClick={() => void play(key as PopSound, count)}>▶ {count} XP</button></div>)}</div></details>
      {error && <p role="alert">Playback failed: {error}</p>}
    </section>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
