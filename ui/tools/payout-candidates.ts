/** Authored preview candidates. Pickup texture and completion have separate roles.
 * [@jacobsenGameAudioFatigue2018] [@levelCurveStorefront2023] */
export const PAYOUT_CANDIDATES = {
  chime: 'Soft chime', coin: 'Muted coin', arcade: 'Dry arcade',
} as const
export type PayoutCandidate = keyof typeof PAYOUT_CANDIDATES

/** Render once so the entire burst uses the audio clock, not UI timers. */
export function renderPayoutCandidate(kind: PayoutCandidate, count: number, rate = 48000): Float32Array {
  if (!Number.isInteger(count) || count < 1 || count > 32) throw new Error('XP count must be 1–32')
  const interval = Math.min(.105, 1.65 / count)
  const finish = (count - 1) * interval + .12
  const samples = new Float32Array(Math.ceil((finish + .45) * rate))
  let seed = 1729
  const noise = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2147483648 - 1 }
  function tone(at: number, hz: number, duration: number, gain: number, texture: PayoutCandidate, ending = false) {
    const offset = Math.round(at * rate)
    for (let i = 0; i < duration * rate && offset + i < samples.length; i++) {
      const t = i / rate
      const envelope = Math.min(1, t / .0025) * Math.exp(-t / (duration / 5)) * Math.min(1, (duration - t) / .008)
      const phase = 2 * Math.PI * hz * t
      let wave: number
      if (texture === 'chime') {
        wave = Math.sin(phase) + .22 * Math.sin(phase * 2) * Math.exp(-t / .025)
        wave += .12 * noise() * Math.exp(-t / .004)
      } else if (texture === 'coin') {
        wave = .72 * Math.sin(phase) + .28 * Math.sin(phase * 2.76) * Math.exp(-t / .025)
        wave += .2 * noise() * Math.exp(-t / .006)
      } else {
        // A band-limited pulse with a short initial pitch flick, avoiding a raw square wave.
        const flick = phase + 2 * Math.PI * hz * .0006 * (1 - Math.exp(-t / .004))
        wave = Math.sin(flick) + .22 * Math.sin(3 * flick) + .08 * Math.sin(5 * flick)
      }
      samples[offset + i] += wave * envelope * gain * (ending ? 1.08 : 1)
    }
  }
  const root = kind === 'chime' ? 660 : kind === 'coin' ? 880 : 740
  const duration = kind === 'chime' ? .105 : kind === 'coin' ? .075 : .055
  for (let i = 0; i < count; i++) {
    const step = count === 1 ? 0 : Math.floor(i / (count - 1) * 3)
    const semitones = [0, 2, 4, 7][step]
    tone(i * interval, root * 2 ** (semitones / 12), duration, .11, kind)
  }
  if (kind === 'arcade') {
    tone(finish, root * 1.5, .07, .09, kind, true)
    tone(finish + .075, root * 2, .16, .1, kind, true)
  } else {
    tone(finish, root * 2, .29, .085, kind, true)
    tone(finish, root, .22, .045, 'chime', true)
  }
  // Equalize short-window RMS across candidates; keep the burst's natural dynamics.
  let peakEnergy = 0
  const window = Math.round(rate * .04)
  let energy = 0
  for (let i = 0; i < samples.length; i++) {
    energy += samples[i] ** 2 - (i >= window ? samples[i - window] ** 2 : 0)
    peakEnergy = Math.max(peakEnergy, energy / window)
  }
  const gain = .045 / Math.sqrt(peakEnergy)
  for (let i = 0; i < samples.length; i++) samples[i] *= gain
  return samples
}
