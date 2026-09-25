import { useEffect, useRef, useState } from 'react'
import { PAYOUT_CANDIDATES, renderPayoutCandidate, type PayoutCandidate } from './payout-candidates'

export function PayoutCandidateControls({ count, volume, enabled, beforePlay, onCount }: {
  count: number; volume: number; enabled: boolean; beforePlay: () => void; onCount: (count: number) => void
}) {
  const host = useRef<HTMLFieldSetElement>(null)
  const context = useRef<AudioContext | null>(null)
  const source = useRef<AudioBufferSourceNode | null>(null)
  const output = useRef<GainNode | null>(null)
  const [playing, setPlaying] = useState<PayoutCandidate | null>(null)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const stop = () => { generation.current++; source.current?.stop(); source.current = null; setPlaying(null) }
  useEffect(() => { if (output.current) output.current.gain.value = volume }, [volume])
  useEffect(() => { if (!enabled) stop() }, [enabled])
  useEffect(() => {
    const hide = () => { if (document.hidden) stop() }
    const outside = (event: Event) => { if (event.target instanceof Node && !host.current?.contains(event.target)) stop() }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', outside)
    document.addEventListener('visibilitychange', hide)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', outside); document.removeEventListener('visibilitychange', hide); generation.current++; source.current?.stop(); void context.current?.close() }
  }, [])
  const play = async (kind: PayoutCandidate) => {
    stop(); beforePlay(); setError('')
    const current = generation.current
    try {
      const audio = context.current ??= new AudioContext()
      output.current ??= audio.createGain()
      output.current.disconnect(); output.current.connect(audio.destination)
      output.current.gain.value = volume
      await audio.resume()
      if (current !== generation.current) return
      const data = renderPayoutCandidate(kind, count, audio.sampleRate)
      const buffer = audio.createBuffer(1, data.length, audio.sampleRate)
      buffer.getChannelData(0).set(data)
      const node = audio.createBufferSource()
      node.buffer = buffer; node.connect(output.current); source.current = node
      node.onended = () => { node.disconnect(); if (source.current === node) { source.current = null; setPlaying(null) } }
      setPlaying(kind); node.start()
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }
  return <fieldset ref={host} className="payout-candidates"><legend>Compare sounds</legend>
    <div className="sound-lab-actions">
      <label className="sound-lab-count">XP count<input aria-label="Comparison XP count" type="number" min={1} max={32} value={count} onChange={event => { const n = Number(event.target.value); if (Number.isInteger(n) && n >= 1 && n <= 32) onCount(n) }} /></label>
      {Object.entries(PAYOUT_CANDIDATES).map(([key, label]) => <button className="btn" key={key} disabled={!enabled} aria-pressed={playing === key} title={`Play ${count} XP · ${label}`} onClick={() => void play(key as PayoutCandidate)}>▶ {label}</button>)}
      <button className="btn" onClick={stop}>Stop</button>
    </div>
    {error && <p role="alert">Audio preview failed: {error}</p>}
  </fieldset>
}
