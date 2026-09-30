import { reportFault } from '../diagnostics/faults'
import { speechPlaybackPermit } from './speech'

let context: AudioContext | null = null
export function speechContext(): AudioContext {
  if (!context || context.state === 'closed') context = new AudioContext({ latencyHint: 'interactive' })
  return context
}

/** Unlock on a real interaction, before an asynchronous synthesis response arrives. */
export function unlockSpeechAudio(): void {
  if (!speechPlaybackPermit() || typeof AudioContext === 'undefined') return
  try {
    const audio = speechContext()
    if (audio.state === 'suspended') void audio.resume().catch(error => reportFault('Enabling speech playback', error))
  } catch (error) { reportFault('Enabling speech playback', error) }
}
