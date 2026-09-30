import { bindRewardOrigin, captureRewardOrigin, publishEffortAwards } from './reward-origin'
import type { ReadingInput, ReadingResult, SpeechAudio } from '../../generated/contracts'
import { invoke } from './native'
import { ownedRequest } from './owned-request'
import { effortPublished } from './effort-events'

export async function readSelection(input: ReadingInput, signal: AbortSignal, options?: { retry?: boolean }): Promise<ReadingResult> {
  const origin = captureRewardOrigin()
  return ownedRequest(signal, () => invoke<string>('begin_reading', { input, fresh: options?.retry ?? false }),
    async id => {
      const result = await invoke<ReadingResult>('run_reading', { id }, signal)
      const receipt = result.receipt as { effortAward?: import('../../generated/contracts').EffortAward } | null
      if (receipt?.effortAward) {
        bindRewardOrigin(receipt.effortAward.sourceId, origin)
        publishEffortAwards([receipt.effortAward])
      }
      effortPublished()
      return result
    },
    id => invoke<void>('cancel_reading', { id }), 'Closing reading help')
}
export function readingActivity(): Promise<unknown> { return invoke<unknown>('get_reading_activity') }

/** Inspect retained audio without starting inference or playback. */
export function cachedReadingAudio(input: ReadingInput): Promise<SpeechAudio | null> {
  return invoke('get_cached_reading_audio', { input })
}
