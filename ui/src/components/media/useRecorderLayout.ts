import { useStoredChoice } from '../persistence/useStoredChoice'

/** Which physical side of the recorder the microphone button sits on. */
export type PadSide = 'left' | 'right'
/** Which way time runs across the live stream: `ltr` puts the newest sound on
 * the right, as the Practice comparison's “Time →” does. */
export type StreamTime = 'ltr' | 'rtl'

export interface RecorderLayout {
  padSide: PadSide
  onPadSide: (side: PadSide) => void
  time: StreamTime
  onTime: (time: StreamTime) => void
}

const SIDES = ['left', 'right'] as const
const TIMES = ['ltr', 'rtl'] as const

/** A recording panel's button side and stream direction, each chosen on its
 * own and kept per panel on this device. Until the learner chooses, the button
 * sits at the end of `direction` and time runs the same way, so new sound
 * enters beside the button. */
export function useRecorderLayout(panel: 'chat' | 'practice', direction: 'ltr' | 'rtl'): RecorderLayout {
  const [padSide, onPadSide] = useStoredChoice(`skellyspeak_recorder_${panel}_pad`, SIDES)
  const [time, onTime] = useStoredChoice(`skellyspeak_recorder_${panel}_time`, TIMES)
  return {
    padSide: padSide ?? (direction === 'rtl' ? 'left' : 'right'),
    onPadSide,
    time: time ?? direction,
    onTime,
  }
}
