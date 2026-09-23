import type { ReadingInput, ReadingResult } from '../../generated/contracts'
import { readSelection } from '../ipc/reading'
import { playSpeechAudio } from './speech-player'
import { interruptSpeech, onSpeechInterrupted, speechPlaybackPermit } from './speech'

async function withPlayback<T>(signal: AbortSignal, work: (lifetime: AbortSignal, permit: object) => Promise<T>): Promise<T> {
  signal.throwIfAborted()
  const permit = interruptSpeech()
  if (!permit) throw new Error('Speech playback is currently unavailable.')
  const interrupted = new AbortController()
  const stopListening = onSpeechInterrupted(() => interrupted.abort())
  const lifetime = AbortSignal.any([signal, interrupted.signal])
  try { return await work(lifetime, permit) } finally { stopListening() }
}

async function play(base64: string, signal: AbortSignal, permit: object, onPlayback: () => void, rate: number, volume: number): Promise<void> {
  signal.throwIfAborted()
  if (speechPlaybackPermit() !== permit) throw new DOMException('Speech was stopped', 'AbortError')
  onPlayback()
  await new Promise<void>((resolve, reject) => {
    const finish = () => { signal.removeEventListener('abort', cancel); resolve() }
    const fail = (error: Error) => { signal.removeEventListener('abort', cancel); reject(error) }
    const player = playSpeechAudio({ status: 'ready', operationId: '', attemptId: '', messageId: '', mime: 'audio/wav', audioBase64: base64 }, finish, fail, rate, volume)
    const cancel = () => { player.stop(); finish() }
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
    else void player.play().catch(error => { player.stop(); fail(error) })
  })
  signal.throwIfAborted()
}

/** Replay retained audio with the same cancellation and exclusion as fetched speech. */
export function replaySelectionAudio(base64: string, signal: AbortSignal, onPlayback: () => void, rate: number, volume: number): Promise<void> {
  return withPlayback(signal, (lifetime, permit) => play(base64, lifetime, permit, onPlayback, rate, volume))
}

/** Fetch once; callers may keep the result and replay it without another request. */
export function speakSelection(input: ReadingInput, signal: AbortSignal, onPlayback: () => void, rate: number, volume: number): Promise<ReadingResult> {
  return withPlayback(signal, async (lifetime, permit) => {
    const result = await readSelection(input, lifetime)
    lifetime.throwIfAborted()
    if (!result.audioBase64) throw new Error('The speech service returned no audio.')
    await play(result.audioBase64, lifetime, permit, onPlayback, rate, volume)
    return result
  })
}
