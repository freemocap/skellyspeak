/** Simple original studies of common UI constructions; no sampled game assets.
 * Layered bell/coin examples: [@levelCurveStorefront2023]. */
export const POP_SOUNDS = {
  retroCoin: 'Arcade coin', softCoin: 'Arcade coin · soft', shortCoin: 'Arcade coin · short',
  click: 'Soft click', tap: 'Wooden tap', beep: 'Short beep', lowBeep: 'Low beep',
  ping: 'Bell ping', mutedPing: 'Muted bell', coin: 'Coin pickup', confirm: 'Two-note confirmation',
} as const
export type PopSound = keyof typeof POP_SOUNDS

/** Repeats the same cue: no burst-wide rise, random pitch, or added ending. */
export function renderPops(kind: PopSound, count: number, rate = 48000, intervalMs = 230): Float32Array {
  if (!Number.isInteger(count) || count < 1 || count > 32) throw new Error('Count must be 1–32')
  if (!Number.isFinite(intervalMs) || intervalMs < 40 || intervalMs > 1000) throw new Error('Interval must be 40–1000 ms')
  const cue = new Float32Array(Math.ceil(.32 * rate))
  function tone(hz: number, at: number, duration: number, amplitude: number, decay = true) {
    const offset = Math.round(at * rate)
    for (let i = 0; i < duration * rate && offset + i < cue.length; i++) {
      const t = i / rate
      const envelope = Math.min(1, t / .002) * Math.min(1, (duration - t) / .012)
        * (decay ? Math.exp(-t * 5 / duration) : 1)
      cue[offset + i] += Math.sin(2 * Math.PI * hz * t) * envelope * amplitude
    }
  }
  // Two successive pitches with pulse harmonics, not overlapping sine tones.
  // Pitch-pair reference: [@berkeleyCoinBank2013]; envelopes are original.
  function arcadeCoin(softness: number, length: number) {
    const lead = .025
    for (let i = 0; i < length * rate; i++) {
      const t = i / rate
      const hz = t < lead ? 987.77 : 1318.51
      const phase = 2 * Math.PI * (t < lead ? hz * t : 987.77 * lead + hz * (t - lead))
      let wave = 0
      for (let harmonic = 1; harmonic <= 9 && harmonic * hz < rate / 2; harmonic++) {
        const coefficient = Math.sin(Math.PI * harmonic * .25) / harmonic
        wave += coefficient * Math.cos(phase * harmonic - Math.PI * harmonic * .25) * Math.exp(-softness * (harmonic - 1))
      }
      const envelope = Math.min(1, t / .001) * Math.min(1, (length - t) / .006)
        * (t < lead ? 1 : Math.exp(-(t - lead) / ((length - lead) / 3)))
      cue[i] += wave * envelope * .09
    }
  }
  function click(amplitude: number) {
    let seed = 481, filtered = 0
    const alpha = 1 - Math.exp(-2 * Math.PI * 1800 / rate)
    for (let i = 0; i < .018 * rate; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0
      const t = i / rate
      filtered += alpha * (seed / 2147483648 - 1 - filtered)
      cue[i] += filtered * Math.min(1, t / .001) * Math.exp(-t / .0028) * amplitude
    }
  }
  switch (kind) {
    case 'retroCoin': arcadeCoin(.05, .15); break
    case 'softCoin': arcadeCoin(.5, .12); break
    case 'shortCoin': arcadeCoin(.18, .075); break
    case 'click': click(.32); break
    case 'tap': tone(650, 0, .035, .16); tone(1430, 0, .018, .06); break
    case 'beep': tone(880, 0, .055, .06, false); break
    case 'lowBeep': tone(440, 0, .065, .06, false); break
    case 'ping': tone(1046.5, 0, .24, .12); tone(2093, 0, .08, .025); break
    case 'mutedPing': tone(784, 0, .09, .13); tone(1568, 0, .025, .02); break
    case 'coin': click(.12); tone(1318.5, 0, .09, .08); tone(1975.5, .035, .13, .075); break
    case 'confirm': tone(659.25, 0, .07, .075); tone(880, .085, .13, .09); break
  }
  const interval = intervalMs / 1000
  const output = new Float32Array(Math.ceil(((count - 1) * interval + .34) * rate))
  for (let n = 0; n < count; n++) {
    const start = Math.round(n * interval * rate)
    for (let i = 0; i < cue.length; i++) output[start + i] += cue[i]
  }
  return output
}
