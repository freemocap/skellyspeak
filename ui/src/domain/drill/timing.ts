import type { InspectionActivity } from '../../generated/contracts'

/** How a recording used its time, from the detected activity alone. Detection
 * is an energy heuristic: these are measurements of sound, not of words. */
export interface SpeechTiming {
  /** Seconds inside detected activity regions. */
  speaking: number
  /** Gaps between detected regions; leading and trailing silence are not pauses. */
  pauses: number
  longestPause: number | null
  /** Target words per second of detected activity, when there was any. */
  wordsPerSecond: number | null
}

export function speechTiming(activity: InspectionActivity, words: number): SpeechTiming {
  if (!Number.isInteger(words) || words < 0) throw new Error(`Invalid word count: ${words}`)
  const speaking = activity.regions.reduce((sum, region) => {
    if (region.end < region.start) throw new Error('An activity region ends before it starts.')
    return sum + region.end - region.start
  }, 0)
  return {
    speaking,
    pauses: activity.pauses.length,
    longestPause: activity.pauses.length ? Math.max(...activity.pauses.map(pause => pause.duration)) : null,
    wordsPerSecond: speaking > 0 ? words / speaking : null,
  }
}
