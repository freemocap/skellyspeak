import { COIN_SCALES, coinNotes, type CoinVoice } from '../src/platform/audio/coin-voice'
import type { Beep } from '../src/platform/audio/reward-sounds'
export interface PayoutPhrase { count: number; rising: boolean; resolution: boolean; octaves: number; ending: 'lastCoin' | 'extraNotes' }
export const DEFAULT_PAYOUT_PHRASE: PayoutPhrase = { count: 12, rising: true, resolution: true, octaves: 1, ending: 'lastCoin' }
/** Plan the whole phrase before playback. The final tonic is its highest note.
 * Extra cadence notes are audio only and never count as earned points. */
export function risingPayout(voice: CoinVoice, phrase: PayoutPhrase, onsets: number[], random = Math.random): { at: number; notes: Beep[]; ghost: boolean }[] {
  const scale = COIN_SCALES[voice.scale]
  const top = (voice.scaleSnapping ? scale.length : 12) * phrase.octaves
  let root = voice.rootMidi
  while (root + phrase.octaves * 12 > 100) root -= 12
  const frequency = (degree: number) => 440 * 2 ** ((root + (voice.scaleSnapping ? scale[degree % scale.length] + 12 * Math.floor(degree / scale.length) : degree) - 69) / 12)
  const total = phrase.count * voice.notes
  const ordinary = onsets.map(() => coinNotes(voice, Math.floor(random() * scale.length)))
  if (!phrase.rising && !phrase.resolution) return onsets.map((at, index) => ({ at, notes: ordinary[index], ghost: false }))
  let finalFrequency = frequency(top)
  if (!phrase.rising) {
    const highest = Math.max(...ordinary.flatMap(notes => notes.map(note => note.frequency)))
    finalFrequency = frequency(0)
    while (finalFrequency < highest) finalFrequency *= 2
  }
  let latestEnd = 0
  let lastOnset = -.01
  const events = onsets.map((requestedOnset, coin) => {
    const onset = Math.max(requestedOnset, (lastOnset + .01) * 1000)
    const notes = Array.from({ length: voice.notes }, (_, note) => {
      const index = coin * voice.notes + note
      const final = phrase.resolution && phrase.ending === 'lastCoin' && index === total - 1
      const position = index / Math.max(1, total - 1) * (top - (phrase.resolution ? (phrase.ending === 'extraNotes' ? 2 : 1) : 0))
      const degree = final ? top : voice.scaleSnapping ? Math.floor(position) : position
      const at = final ? Math.max(note * voice.spacingMs / 1000, latestEnd - onset / 1000 + .04) : note * voice.spacingMs / 1000
      const duration = final ? Math.max(.28, voice.decayMs / 1000) : voice.decayMs / 1000
      lastOnset = onset / 1000 + at
      latestEnd = Math.max(latestEnd, onset / 1000 + at + duration)
      return { frequency: final ? finalFrequency : phrase.rising ? frequency(degree) : ordinary[coin][note].frequency, at, duration }
    })
    return { at: onset, notes, ghost: false }
  })
  if (phrase.resolution && phrase.ending === 'extraNotes') events.push({ at: (latestEnd + .06) * 1000, ghost: true, notes: [
    { frequency: phrase.rising ? frequency(top - 2) : finalFrequency * 2 ** ((voice.scaleSnapping ? scale[scale.length - 2] - 12 : -2) / 12), at: 0, duration: .1 },
    { frequency: finalFrequency, at: .14, duration: .32 },
  ] })
  return events
}
