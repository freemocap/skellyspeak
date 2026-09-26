import type { ReadingInput, ReadingResult, SpeechAudio } from '../../generated/contracts'
import { invoke } from './native'
import { ownedRequest } from './owned-request'

export async function readSelection(input: ReadingInput, signal: AbortSignal, options?: { retry?: boolean }): Promise<ReadingResult> {
  return ownedRequest(signal, () => invoke<string>('begin_reading', { input, fresh: options?.retry ?? false }),
    id => invoke<ReadingResult>('run_reading', { id }, signal),
    id => invoke<void>('cancel_reading', { id }), 'Closing reading help')
}
export function readingActivity(): Promise<unknown> { return invoke<unknown>('get_reading_activity') }

/** Inspect retained audio without starting inference or playback. */
export function cachedReadingAudio(input: ReadingInput): Promise<SpeechAudio | null> {
  return invoke('get_cached_reading_audio', { input })
}
