import { reportFault } from '../diagnostics/faults'
import { visibleRewardRect } from '../../domain/reward/reward-anchors'
import { cssToken } from '../css-token'
export type RewardSoundMode = 'yes' | 'no' | 'follow_tts'
export type SoundCue = { kind: 'xp'; xp: number } | { kind: 'confused' } | { kind: 'understood' } | { kind: 'pop' }
export interface Beep { frequency: number; at: number; duration: number }

export function soundEnabled(mode: RewardSoundMode, readAloud: boolean): boolean {
  return mode === 'yes' || (mode === 'follow_tts' && readAloud)
}

/** Short original square-wave motifs; larger rewards rise higher, never louder. */
export function soundPattern(cue: SoundCue): Beep[] {
  if (cue.kind === 'xp' && (!Number.isFinite(cue.xp) || cue.xp <= 0)) throw new Error('Reward sounds require positive XP.')
  if (cue.kind === 'pop') return [{ frequency: 520, at: 0, duration: 0.075 }, { frequency: 1040, at: 0.055, duration: 0.12 }]
  const pitches = cue.kind === 'confused' ? [440, 370, 392]
    : cue.kind === 'understood' ? [659, 988]
    : cue.xp >= 20 ? [784, 988, 1175, 1568] : cue.xp >= 10 ? [784, 988, 1319] : [784, 1047]
  return pitches.map((frequency, index) => ({ frequency, at: index * 0.075, duration: 0.07 }))
}

let enabled = false
let allowed = true
let context: AudioContext | null = null
let output: GainNode | null = null
let volume = 1
let nextStart = 0
const voices = new Set<OscillatorNode>()
const flashes = new Set<Animation>()

export function setRewardVolume(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Effects volume must be between 0 and 1.')
  volume = value
  if (output) output.gain.value = volume
}

export function stopRewardSounds(): void {
  for (const voice of voices) { voice.stop(); voice.disconnect() }
  voices.clear()
  for (const flash of flashes) flash.cancel()
  flashes.clear()
  nextStart = 0
}
export function configureRewardSounds(mode: RewardSoundMode, readAloud: boolean): void {
  enabled = soundEnabled(mode, readAloud)
  if (!enabled) stopRewardSounds()
}
export function setRewardPlaybackAllowed(value: boolean): void {
  allowed = value
  if (!allowed) stopRewardSounds()
}
export function unlockRewardAudio(): void {
  if (!enabled || !allowed || document.visibilityState === 'hidden') return
  if (!context) {
    context = new AudioContext()
    output = context.createGain()
    output.gain.value = volume
    output.connect(context.destination)
  }
  // WebKit also pauses contexts as interrupted after native audio or app suspension.
  if (context.state !== 'running' && context.state !== 'closed') void context.resume().catch(error => reportFault('Enabling reward sounds', error))
}

/** No historical replay, no background queue, and no sound without a visible cause. */
export function playRewardSound(cue: SoundCue, target: HTMLElement): boolean {
  const notes = soundPattern(cue)
  if (!enabled || !allowed || volume === 0 || document.visibilityState === 'hidden' || context?.state !== 'running' || !target.isConnected) return false
  if (!visibleRewardRect(target, document.body)) return false
  const audio = context
  const start = Math.max(audio.currentTime, nextStart)
  if (start - audio.currentTime > 0.45) return false
  nextStart = start + 0.12
  for (const note of notes) {
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = cue.kind === 'pop' ? 'triangle' : 'square'
    oscillator.frequency.value = note.frequency
    const at = start + note.at
    if (cue.kind === 'pop') {
      oscillator.frequency.setValueAtTime(note.frequency, at)
      oscillator.frequency.exponentialRampToValueAtTime(note.frequency * 1.35, at + note.duration * .55)
    }
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(cue.kind === 'pop' ? 0.09 : 0.025, at + 0.004)
    gain.gain.exponentialRampToValueAtTime(0.001, at + note.duration)
    oscillator.connect(gain)
    gain.connect(output!)
    voices.add(oscillator)
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect() }
    oscillator.start(at)
    oscillator.stop(at + note.duration + 0.01)
  }
  const flashTarget = cue.kind === 'pop' ? target.closest<HTMLElement>('.msg') ?? target : target
  const glow = cssToken('--reward-flash')
  const flash = flashTarget.animate([
    { boxShadow: `0 0 0 2px ${glow}, 0 0 12px color-mix(in srgb, ${glow} 40%, transparent)` },
    { boxShadow: '0 0 0 0px transparent, 0 0 0px transparent' },
  ], { delay: (start - audio.currentTime) * 1000, duration: 240, easing: 'ease-out' })
  flashes.add(flash)
  flash.onfinish = () => { flashes.delete(flash) }
  return true
}
