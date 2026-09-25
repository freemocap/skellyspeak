import { PayoutCandidateControls } from './PayoutCandidateControls'
import { DEFAULT_PAYOUT_PHRASE, risingPayout, type PayoutPhrase } from './payout-phrase'
import { DEFAULT_PAYOUT_TIMING, payoutOnsets, type PayoutTiming } from './payout-timing'
import { useCallback, useEffect, useRef, useState } from 'react'
import { stringify } from 'yaml'
import { DEFAULT_COIN_VOICE, type CoinVoice } from '../src/platform/audio/coin-voice'
import { configureCoinVoice, configureRewardSounds, playRewardSound, setRewardVolume, stopRewardSounds, unlockRewardAudio } from '../src/platform/audio/reward-sounds'
import './xp-payout-preview.css'

const scales = { pentatonic: 'Major pentatonic', minorPentatonic: 'Minor pentatonic', blues: 'Blues', major: 'Major', dorian: 'Dorian', phrygian: 'Phrygian', wholeTone: 'Whole tone' }
const presets: Record<string, CoinVoice> = {
  Coin: { ...DEFAULT_COIN_VOICE },
  Bell: { ...DEFAULT_COIN_VOICE, waveform: 'sine', notes: 3, steps: 1, spacingMs: 40, decayMs: 180, bend: 0 },
  Blues: { ...DEFAULT_COIN_VOICE, scale: 'blues', contour: 'zigzag', notes: 4, rootMidi: 67, spacingMs: 35, bend: -3 },
  Arcade: { ...DEFAULT_COIN_VOICE, waveform: 'square', scale: 'minorPentatonic', notes: 3, steps: 3, decayMs: 65, bend: -5 },
}
export function CoinSoundControls({ enabled, volume, onVolume }: { enabled: boolean; volume: number; onVolume: (volume: number) => void }) {
  const [phrase, setPhrase] = useState<PayoutPhrase>({ ...DEFAULT_PAYOUT_PHRASE })
  const [timing, setTiming] = useState<PayoutTiming>({ ...DEFAULT_PAYOUT_TIMING })
  const [autoplay, setAutoplay] = useState(false)
  const host = useRef<HTMLElement>(null)
  const timers = useRef<number[]>([])
  const cancelPreview = useCallback(() => { timers.current.forEach(window.clearTimeout); timers.current = []; stopRewardSounds() }, [])
  const [voice, setVoice] = useState<CoinVoice>({ ...DEFAULT_COIN_VOICE })
  useEffect(() => { configureCoinVoice(voice) }, [voice])
  useEffect(() => { setRewardVolume(volume) }, [volume])
  const armAudio = () => {
    configureRewardSounds(enabled ? 'yes' : 'no', false)
    unlockRewardAudio()
  }
  const playPayout = useCallback(() => {
    cancelPreview()
    if (!enabled || !host.current) return
    configureRewardSounds('yes', false)
    unlockRewardAudio()
    const onsets = payoutOnsets(timing, Math.random, phrase.count)
    const events = risingPayout(voice, phrase, onsets)
    for (const event of events) {
      timers.current.push(window.setTimeout(() => {
        if (host.current) playRewardSound({ kind: 'xp', xp: 1 }, host.current, 'immediate', event.notes)
      }, event.at))
    }
  }, [enabled, timing, voice, phrase, cancelPreview])
  const previous = useRef({ voice, volume, timing, phrase })
  useEffect(() => {
    const changed = previous.current.voice !== voice || previous.current.volume !== volume || previous.current.timing !== timing || previous.current.phrase !== phrase
    previous.current = { voice, volume, timing, phrase }
    cancelPreview()
    if (changed && autoplay && enabled) timers.current.push(window.setTimeout(playPayout, 180))
    return cancelPreview
  }, [voice, volume, timing, phrase, autoplay, enabled, playPayout, cancelPreview])
  const change = <K extends keyof CoinVoice>(key: K, value: CoinVoice[K]) => setVoice(current => ({ ...current, [key]: value }))
  const audition = (target: HTMLElement, milestone = false) => {
    cancelPreview()
    configureRewardSounds(enabled ? 'yes' : 'no', false)
    unlockRewardAudio()
    playRewardSound(milestone ? { kind: 'milestone' } : { kind: 'xp', xp: 1 }, target)
  }
  const slider = (key: 'rootMidi' | 'steps' | 'notes' | 'spacingMs' | 'decayMs' | 'attackMs' | 'bend', label: string, min: number, max: number, unit = '', step = 1) => <label className="sound-lab-field" key={key}>
    <span>{label}<output>{voice[key]}{unit}</output></span>
    <input disabled={phrase.rising && key === 'steps'} aria-label={label} type="range" min={min} max={max} step={step} value={voice[key]} onChange={event => change(key, Number(event.target.value))} />
  </label>
  return <section ref={host} onPointerDownCapture={armAudio} onKeyDownCapture={armAudio} className="sound-lab" aria-label="Payout sound controls">
    <PayoutCandidateControls count={phrase.count} volume={volume} enabled={enabled} beforePlay={cancelPreview} onCount={count => { setAutoplay(false); setPhrase(current => ({ ...current, count })) }} />
    <header><h2>Payout sound</h2><div className="sound-lab-actions">
      {Object.entries(presets).map(([name, preset]) => <button className="btn" key={name} onClick={() => setVoice({ ...preset })}>{name}</button>)}
    </div></header>
    <div className="sound-lab-grid">
      <fieldset><legend>Pitch</legend>
        <label><input type="checkbox" checked={voice.scaleSnapping} onChange={event => change('scaleSnapping', event.target.checked)} />Scale snapping</label>
        <label className="sound-lab-field">Scale<select disabled={!voice.scaleSnapping} value={voice.scale} onChange={event => change('scale', event.target.value as CoinVoice['scale'])}>{Object.entries(scales).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {slider('rootMidi', 'Root pitch (MIDI)', 48, 84)}
        {slider('steps', voice.scaleSnapping ? 'Scale degrees per step' : 'Semitones per step', 0, 4, '', voice.scaleSnapping ? 1 : .25)}
        <label><input disabled={phrase.rising} type="checkbox" checked={voice.variation} onChange={event => change('variation', event.target.checked)} />Vary starting note</label>
      </fieldset>
      <fieldset><legend>Shape</legend>
        <label className="sound-lab-field">Contour<select disabled={phrase.rising} value={voice.contour} onChange={event => change('contour', event.target.value as CoinVoice['contour'])}>{Object.entries({ rise: 'Rising', fall: 'Falling', arch: 'Arch', zigzag: 'Zigzag' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {slider('notes', 'Notes per coin', 1, 5)}
        {slider('spacingMs', 'Note spacing', 10, 80, ' ms')}
        {slider('bend', 'Initial pitch bend', -12, 12, ' st', .25)}
      </fieldset>
      <fieldset><legend>Tone</legend>
        <label className="sound-lab-field">Waveform<select value={voice.waveform} onChange={event => change('waveform', event.target.value as CoinVoice['waveform'])}>{['sine', 'triangle', 'square', 'sawtooth'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        {slider('attackMs', 'Attack', 1, 20, ' ms')}
        {slider('decayMs', 'Decay', 40, 220, ' ms')}
        <label className="sound-lab-field"><span>Preview volume<output>{Math.round(volume * 100)}%</output></span><input aria-label="Preview volume" type="range" min={0} max={100} value={Math.round(volume * 100)} onChange={event => onVolume(Number(event.target.value) / 100)} /></label>
      </fieldset>
      <fieldset className="sound-lab-wide"><legend>Whole payout</legend>
        <label title="Plans an ascending phrase. Overrides per-coin contour and random starting pitches."><input type="checkbox" checked={phrase.rising} onChange={event => setPhrase(current => ({ ...current, rising: event.target.checked }))} />Global rise</label>
        <label className="sound-lab-field">Rise<select disabled={!phrase.rising} value={phrase.octaves} onChange={event => setPhrase(current => ({ ...current, octaves: Number(event.target.value) }))}><option value={1}>One octave</option><option value={2}>Two octaves</option></select></label>
        <label><input type="checkbox" checked={phrase.resolution} onChange={event => setPhrase(current => ({ ...current, resolution: event.target.checked }))} />Resolution</label>
        <label className="sound-lab-field">Finish<select disabled={!phrase.resolution} value={phrase.ending} onChange={event => setPhrase(current => ({ ...current, ending: event.target.value as PayoutPhrase['ending'] }))}><option value="lastCoin">Resolve on last coin</option><option value="extraNotes">Add ending notes · no XP</option></select></label>
      </fieldset>
      <fieldset className="sound-lab-wide"><legend>Rhythm</legend>
        <label className="sound-lab-field">Timing shape<select value={timing.shape} onChange={event => setTiming(current => ({ ...current, shape: event.target.value as PayoutTiming['shape'] }))}>{Object.entries({ steady: 'Even', accelerate: 'Accelerating', decelerate: 'Slowing down', swell: 'Slow–fast–slow', swing: 'Swing' }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {([['intervalMs', 'Coin interval', 40, 600, ' ms'], ['strength', 'Shape strength', 0, 80, '%'], ['variation', 'Timing variation', 0, 80, '%']] as const).map(([key, label, min, max, unit]) => <label className="sound-lab-field" key={key}><span>{label}<output>{timing[key]}{unit}</output></span><input aria-label={label} type="range" min={min} max={max} value={timing[key]} onChange={event => setTiming(current => ({ ...current, [key]: Number(event.target.value) }))} /></label>)}
        <label className="sound-lab-field">Variation shape<select value={timing.distribution} onChange={event => setTiming(current => ({ ...current, distribution: event.target.value as PayoutTiming['distribution'] }))}><option value="uniform">Uniform random</option><option value="centered">Mostly near the beat</option><option value="smooth">Smooth drift</option></select></label>
      </fieldset>
    </div>
    <footer className="sound-lab-actions"><div className="sound-lab-play"><label className="sound-lab-count">XP count<input aria-label="XP count" type="number" min={1} max={32} value={phrase.count} onChange={event => { const count = Number(event.target.value); if (Number.isInteger(count) && count >= 1 && count <= 32) setPhrase(current => ({ ...current, count })) }} /></label><button className="btn" disabled={!enabled} onClick={playPayout}>Play {phrase.count} XP</button></div><label className="sound-lab-autoplay"><input type="checkbox" checked={autoplay} onChange={event => setAutoplay(event.target.checked)} />Autoplay preview</label><button className="btn" disabled={!enabled} onClick={event => audition(event.currentTarget)}>Play one coin</button><button className="btn" disabled={!enabled} onClick={event => audition(event.currentTarget, true)}>Play milestone</button><button className="btn" onClick={() => { setVoice({ ...DEFAULT_COIN_VOICE }); onVolume(.2); setTiming({ ...DEFAULT_PAYOUT_TIMING }); setPhrase({ ...DEFAULT_PAYOUT_PHRASE }) }}>Reset</button></footer>
    <details><summary>Current sound · YAML</summary><textarea className="field" aria-label="Current sound YAML" readOnly rows={15} value={stringify({ coin: voice, timing, phrase, previewVolume: volume })} onFocus={event => event.currentTarget.select()} /></details>
  </section>
}
