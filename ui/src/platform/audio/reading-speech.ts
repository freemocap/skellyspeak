import type { ReadingInput } from '../../generated/contracts'
import { readSelection } from '../ipc/reading'
import { playSpeechAudio } from './speech-player'
import { interruptSpeech, onSpeechInterrupted, speechPlaybackPermit } from './speech'

/** Same exclusive playback authority as messages, including requests still loading. */
export async function speakSelection(input: ReadingInput, signal: AbortSignal, onPlayback: () => void, rate: number, volume: number): Promise<unknown> {
  signal.throwIfAborted()
  const permit = interruptSpeech()
  if (!permit) throw new Error('Speech playback is currently unavailable.')
  const interrupted = new AbortController()
  const stopListening = onSpeechInterrupted(() => interrupted.abort())
  const lifetime = AbortSignal.any([signal, interrupted.signal])
  try {
    const result = await readSelection(input, lifetime)
    lifetime.throwIfAborted()
    if (speechPlaybackPermit() !== permit) throw new DOMException('Speech was stopped', 'AbortError')
    if (!result.audioBase64) throw new Error('The speech service returned no audio.')
    onPlayback()
    await new Promise<void>((resolve, reject) => {
      const finish = () => { lifetime.removeEventListener('abort', cancel); resolve() }
      const fail = (error: Error) => { lifetime.removeEventListener('abort', cancel); reject(error) }
      const player = playSpeechAudio({ status: 'ready', operationId: '', attemptId: '', messageId: '', mime: 'audio/wav', audioBase64: result.audioBase64! }, finish, fail, rate, volume)
      const cancel = () => { player.stop(); finish() }
      lifetime.addEventListener('abort', cancel, { once: true })
      if (lifetime.aborted) cancel()
      else void player.play().catch(error => { player.stop(); fail(error) })
    })
    return result.receipt
  } finally { stopListening() }
}
