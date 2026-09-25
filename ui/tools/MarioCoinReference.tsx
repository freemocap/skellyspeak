import { useEffect, useRef, useState } from 'react'

// Remote reference recording for listening comparisons; not an application asset.
const SOURCE = 'https://www.mariowiki.com/images/transcoded/6/67/SMB_Coin.oga/SMB_Coin.oga.mp3'
export function MarioCoinReference({ count, intervalMs, volume, stopSignal, durationMs }: { durationMs: number; stopSignal: number; count: number; intervalMs: number; volume: number }) {
  const sounds = useRef<HTMLAudioElement[]>([])
  const timers = useRef<number[]>([])
  const [error, setError] = useState('')
  const generation = useRef(0)
  const stop = () => {
    generation.current++
    timers.current.forEach(window.clearTimeout); timers.current = []
    sounds.current.forEach(sound => sound.pause()); sounds.current = []
  }
  useEffect(stop, [stopSignal, count, intervalMs, durationMs])
  useEffect(() => {
    const hide = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', hide)
    return () => { stop(); document.removeEventListener('visibilitychange', hide) }
  }, [])
  useEffect(() => { sounds.current.forEach(sound => { sound.volume = volume }) }, [volume])
  const play = (repetitions: number) => {
    stop(); setError('')
    const ticket = generation.current
    const sound = new Audio(SOURCE)
    sound.preload = 'auto'
    sounds.current.push(sound)
    sound.addEventListener('loadedmetadata', () => {
      if (ticket !== generation.current) return
      if (!Number.isFinite(sound.duration) || sound.duration <= 0) {
        setError('The recording has no valid duration.'); return
      }
      const start = (clip: HTMLAudioElement) => {
        clip.volume = volume
        // Fit the whole recording to the selected duration; never trim its end.
        try {
          clip.preservesPitch = false
          clip.playbackRate = sound.duration / (durationMs / 1000)
        } catch (cause) {
          stop(); setError(cause instanceof Error ? cause.message : String(cause)); return
        }
        void clip.play().catch(cause => {
          if (ticket !== generation.current) return
          stop(); setError(cause instanceof Error ? cause.message : String(cause))
        })
      }
      start(sound)
      for (let i = 1; i < repetitions; i++) timers.current.push(window.setTimeout(() => {
        if (ticket !== generation.current) return
        const clip = new Audio(SOURCE)
        sounds.current.push(clip)
        start(clip)
      }, i * intervalMs))
    }, { once: true })
    sound.addEventListener('error', () => {
      if (ticket === generation.current) setError(`Recording load failed (${sound.error?.code ?? 'unknown'}).`)
    }, { once: true })
    sound.load()
  }
  return <section className="sound-choice" aria-label="Original Mario coin recording">
    <strong>Super Mario Bros. · {durationMs} ms</strong>
    <button className="btn" onClick={() => play(1)}>▶ {durationMs} ms</button>
    <button className="btn" onClick={() => play(count)}>▶ {count} coins</button>
    <a href="https://www.mariowiki.com/File:SMB_Coin.oga" target="_blank" rel="noreferrer">Recording source</a>
    <button className="btn" onClick={stop}>Stop</button>
    {error && <p role="alert">Recording playback failed: {error}</p>}
  </section>
}
