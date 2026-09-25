import { expect, it } from 'vitest'
import { DEFAULT_COIN_VOICE, COIN_SCALES } from '../src/platform/audio/coin-voice'
import { DEFAULT_PAYOUT_PHRASE, risingPayout } from '../tools/payout-phrase'
import { DEFAULT_PAYOUT_TIMING, payoutOnsets } from '../tools/payout-timing'
it('resolves every payout size and scale on its highest tonic after earlier tails', () => {
  for (const count of [1, 2, 3, 7, 12, 32]) for (const scale of Object.keys(COIN_SCALES) as (keyof typeof COIN_SCALES)[]) for (const ending of ['lastCoin', 'extraNotes'] as const) {
    const voice = { ...DEFAULT_COIN_VOICE, scale, notes: 5, spacingMs: 80 }
    const events = risingPayout(voice, { ...DEFAULT_PAYOUT_PHRASE, count, ending }, payoutOnsets({ ...DEFAULT_PAYOUT_TIMING, intervalMs: 40 }, Math.random, count))
    expect(events.filter(event => !event.ghost)).toHaveLength(count)
    const notes = events.flatMap(event => event.notes.map(note => ({ ...note, at: event.at / 1000 + note.at })))
    const last = notes.at(-1)!
    expect(last.frequency).toBeCloseTo(440 * 2 ** ((voice.rootMidi + 12 - 69) / 12))
    notes.slice(0, -1).forEach((note, index) => {
      expect(note.frequency).toBeLessThanOrEqual(notes[index + 1].frequency)
      expect(note.at).toBeLessThan(notes[index + 1].at)
      expect(note.at + note.duration).toBeLessThan(last.at)
    })
  }
})
it('supports one note and independent rise and resolution switches', () => {
  const voice = { ...DEFAULT_COIN_VOICE, notes: 1, variation: false }
  for (const rising of [false, true]) for (const resolution of [false, true]) {
    const events = risingPayout(voice, { ...DEFAULT_PAYOUT_PHRASE, rising, resolution, count: 4, ending: 'extraNotes' }, [0, 120, 240, 360])
    expect(events.filter(event => !event.ghost).every(event => event.notes.length === 1)).toBe(true)
    expect(events.filter(event => event.ghost)).toHaveLength(resolution ? 1 : 0)
    const pitches = events.filter(event => !event.ghost).map(event => event.notes[0].frequency)
    expect(new Set(pitches).size > 1).toBe(rising)
    if (resolution) expect(events.at(-1)!.notes.at(-1)!.frequency).toBeGreaterThanOrEqual(Math.max(...pitches))
  }
})
it('rises without quantization when scale snapping is off', () => {
  const events = risingPayout({ ...DEFAULT_COIN_VOICE, scaleSnapping: false, notes: 1 }, { ...DEFAULT_PAYOUT_PHRASE, count: 8, resolution: false }, Array.from({ length: 8 }, (_, i) => i * 120))
  const pitches = events.map(event => 69 + 12 * Math.log2(event.notes[0].frequency / 440))
  expect(pitches[1] - pitches[0]).toBeCloseTo(12 / 7)
  expect(pitches.at(-1)! - pitches[0]).toBeCloseTo(12)
})
