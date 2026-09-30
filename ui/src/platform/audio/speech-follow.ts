import { estimatedSpeechWords, speechWords, spokenWordAt, type SpokenWord } from '../../domain/audio/speech-follow'
import type { SpeechAlignment } from '../../generated/contracts'

export interface SpeechFollow { text: string; word: SpokenWord }
let current: SpeechFollow | null = null
const listeners = new Set<() => void>()
let owner: object | null = null
export const getSpeechFollow = () => current
export const subscribeSpeechFollow = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

/** The shared player publishes word transitions, never animation-frame renders. */
export function publishSpeechFollow(next: SpeechFollow | null) {
  if (current === next || (current?.text === next?.text && current?.word === next?.word)) return
  current = next
  listeners.forEach(listener => listener())
}

export interface SpeechFollowSource { text: string; alignment?: SpeechAlignment | null; context?: { text: string; start: number }; partial?: boolean; words?: SpokenWord[] }

/** Both continuous playback and audible scrubbing use the same visual timing. */
export function createSpeechFollower(source?: SpeechFollowSource) {
  const identity = {}
  const text = source?.text ?? ''
  const context = source?.context
  const anchored = context && context.text.slice(context.start, context.start + text.length) === text ? context : null
  const anchor = (word: SpokenWord) => ({ ...word, start: word.start + (anchored?.start ?? 0), end: word.end + (anchored?.start ?? 0) })
  let words = (source?.words ?? speechWords(text, source?.alignment, source?.partial)).map(anchor)
  const estimated = words.length === 0 && !source?.partial
  let estimatedDuration = 0
  return {
    update(seconds: number, duration: number) {
      if (estimated && Number.isFinite(duration) && duration !== estimatedDuration) {
        estimatedDuration = duration
        words = estimatedSpeechWords(text, duration).map(anchor)
      }
      owner = identity
      const word = spokenWordAt(words, seconds)
      publishSpeechFollow(word ? { text: anchored?.text ?? text, word } : null)
    },
    clear() { if (owner === identity) { owner = null; publishSpeechFollow(null) } },
  }
}
