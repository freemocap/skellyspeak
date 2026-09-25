import { expect, it } from 'vitest'
import { COIN_SCALES, DEFAULT_COIN_VOICE, coinNotes, validateCoinVoice } from './coin-voice'

it('keeps every contour on its selected scale, including descending negative degrees', () => {
  for (const scale of Object.keys(COIN_SCALES) as (keyof typeof COIN_SCALES)[]) {
    for (const contour of ['rise', 'fall', 'arch', 'zigzag'] as const) {
      const voice = { ...DEFAULT_COIN_VOICE, scale, contour, notes: 5, steps: 4 }
      const notes = coinNotes(voice, 0)
      for (const note of notes) {
        const midi = Math.round(69 + 12 * Math.log2(note.frequency / 440))
        expect(COIN_SCALES[scale]).toContain(((midi - voice.rootMidi) % 12 + 12) % 12)
        expect(note.duration).toBeGreaterThan(voice.attackMs / 1000)
      }
    }
  }
})
it('locks the starting note when variation is off and rejects invalid tuning', () => {
  const voice = { ...DEFAULT_COIN_VOICE, variation: false }
  expect(coinNotes(voice, 0)).toEqual(coinNotes(voice, 3))
  expect(() => validateCoinVoice({ ...voice, decayMs: NaN })).toThrow()
  expect(() => validateCoinVoice({ ...voice, notes: 99 })).toThrow()
})
it('allows fractional semitone intervals with scale snapping off', () => {
  const voice = validateCoinVoice({ ...DEFAULT_COIN_VOICE, scaleSnapping: false, variation: false, steps: .25 })
  const notes = coinNotes(voice, 0)
  expect(12 * Math.log2(notes[1].frequency / notes[0].frequency)).toBeCloseTo(.25)
})
