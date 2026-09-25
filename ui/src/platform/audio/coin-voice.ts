/** Presentation-only synthesis parameters; never part of learning records. */
export const COIN_SCALES = {
  pentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
} as const
export interface CoinVoice {
  scaleSnapping: boolean
  scale: keyof typeof COIN_SCALES
  waveform: 'sine' | 'triangle' | 'square' | 'sawtooth'
  contour: 'rise' | 'fall' | 'arch' | 'zigzag'
  rootMidi: number
  steps: number
  notes: number
  spacingMs: number
  decayMs: number
  attackMs: number
  bend: number
  variation: boolean
}
export const DEFAULT_COIN_VOICE: Readonly<CoinVoice> = Object.freeze({
  scaleSnapping: true, scale: 'pentatonic', waveform: 'triangle', contour: 'rise', rootMidi: 72,
  steps: 2, notes: 2, spacingMs: 28, decayMs: 105, attackMs: 2, bend: -1.07, variation: true,
})
export function validateCoinVoice(voice: CoinVoice): CoinVoice {
  if (!Object.hasOwn(COIN_SCALES, voice.scale) || !['sine', 'triangle', 'square', 'sawtooth'].includes(voice.waveform)
    || !['rise', 'fall', 'arch', 'zigzag'].includes(voice.contour) || typeof voice.variation !== 'boolean' || typeof voice.scaleSnapping !== 'boolean') throw new Error('Invalid coin voice')
  for (const [key, min, max, integer] of [
    ['rootMidi', 48, 84, true], ['steps', 0, 4, false], ['notes', 1, 5, true],
    ['spacingMs', 10, 80, false], ['decayMs', 40, 220, false], ['attackMs', 1, 20, false], ['bend', -12, 12, false],
  ] as const) {
    const value = voice[key]
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`Invalid coin voice ${key}`)
  }
  return { ...voice }
}
export function coinNotes(voice: CoinVoice, variation: number, count = voice.notes) {
  const scale = COIN_SCALES[voice.scale]
  const root = voice.variation ? Math.abs(Math.trunc(variation)) % scale.length : 0
  return Array.from({ length: count }, (_, index) => {
    const position = voice.contour === 'fall' ? count - 1 - index
      : voice.contour === 'arch' ? Math.min(index, count - 1 - index)
      : voice.contour === 'zigzag' ? (index % 2 ? -1 : 1) * Math.ceil(index / 2) : index
    const degree = root + position * (voice.scaleSnapping ? Math.round(voice.steps) : voice.steps)
    const semitones = voice.scaleSnapping ? scale[((degree % scale.length) + scale.length) % scale.length] + 12 * Math.floor(degree / scale.length) : degree
    // Keep experimental combinations in a useful audible range.
    let midi = voice.rootMidi + semitones
    while (midi > 100) midi -= 12
    while (midi < 36) midi += 12
    return { frequency: 440 * 2 ** ((midi - 69) / 12), at: index * voice.spacingMs / 1000,
      duration: (index === count - 1 ? voice.decayMs : Math.max(voice.attackMs + 8, voice.decayMs * .305)) / 1000 }
  })
}
