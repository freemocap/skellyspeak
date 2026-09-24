import recordingWorkletUrl from './recording-worklet.ts?worker&url'
import type { WaveSource } from '../../domain/audio/waveform'
import { PcmDelivery } from './pcm-delivery'
import { WaveBuffer } from './wave-buffer'

export interface BrowserRecording {
  wave: WaveSource
  cancel: () => void
  finish: () => Promise<string>
}

/** Mono PCM WAV keeps mobile and desktop on the same transcription contract. */
export function encodeRecording(buffer: AudioBuffer): Uint8Array {
  if (buffer.duration > 120 || buffer.length === 0 || buffer.sampleRate > 96000) throw new Error('Recording exceeds its duration or sample-rate limit.')
  const bytes = new Uint8Array(44 + buffer.length * 2)
  const view = new DataView(bytes.buffer)
  const word = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i) }
  word(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); word(8, 'WAVE'); word(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, buffer.length * 2, true)
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
  for (let i = 0; i < buffer.length; i++) {
    const sample = Math.max(-1, Math.min(1, channels.reduce((sum, channel) => sum + channel[i]!, 0) / channels.length))
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true)
  }
  return bytes
}

/** `deviceId` is the stored selection; null records from the system default.
 * A selected device that is gone fails instead of recording from another one. */
export async function startBrowserRecording(onError: (error: unknown) => void, push?: (samples: number[], sampleRate: number, sequence: number) => Promise<void>, deviceId: string | null = null): Promise<BrowserRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId === null ? true : { deviceId: { exact: deviceId } } }).catch((error: unknown) => {
    if (deviceId !== null && error instanceof Error && (error.name === 'OverconstrainedError' || error.name === 'NotFoundError')) {
      throw Object.assign(new Error('The selected microphone is not connected. Pick another one in Settings, or choose System default.'), { cause: error })
    }
    throw error
  })
  let context: AudioContext
  try { context = new AudioContext() }
  catch (error) { stream.getTracks().forEach(track => track.stop()); throw error }
  let processor: AudioWorkletNode | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false
  let finishing = false
  let complete: (() => void) | undefined
  let rejectFinish: ((error: Error) => void) | undefined
  const chunks: Float32Array[] = []
  let length = 0
  const wave = new WaveBuffer(context.sampleRate)
  let delivery: PcmDelivery | undefined
  const cleanup = () => {
    if (stopped) return
    stopped = true
    delivery?.cancel()
    clearTimeout(timer)
    stream.getTracks().forEach(track => track.stop())
    source?.disconnect()
    if (processor) { processor.port.onmessage = null; processor.port.close(); processor.disconnect() }
    void context.close().catch(onError)
  }
  const fail = (error: unknown) => { if (stopped) return; cleanup(); rejectFinish?.(error as Error); onError(error) }
  if (push) delivery = new PcmDelivery(context.sampleRate, push, fail)
  const cancel = () => { cleanup(); rejectFinish?.(new Error('Recording was cancelled.')) }
  try {
    await context.audioWorklet.addModule(recordingWorkletUrl)
    await context.resume()
    source = context.createMediaStreamSource(stream)
    processor = new AudioWorkletNode(context, 'skellyspeak-recording')
    // The processor emits silence; connection keeps capture running without
    // monitoring the microphone through the speaker.
    source.connect(processor); processor.connect(context.destination)
    processor.onprocessorerror = () => fail(new Error('Microphone sample processing failed.'))
    processor.port.onmessage = (event: MessageEvent<Float32Array | 'finished'>) => {
      if (stopped) return
      if (event.data === 'finished') { complete?.(); return }
      const samples = event.data
      if (!(samples instanceof Float32Array)) { fail(new Error('Invalid microphone samples.')); return }
      wave.append(samples)
      if (push) {
        delivery!.enqueue(samples)
        return
      }
      length += samples.length
      if (length > context.sampleRate * 120) { fail(new Error('Recording exceeded two minutes.')); return }
      chunks.push(samples)
    }
    if (!push) timer = setTimeout(() => fail(new Error('Recording exceeded two minutes. Please record a shorter message.')), 120000)
    return {
      cancel,
      wave,
      finish: () => new Promise<string>((resolve, reject) => {
        if (stopped || finishing) { reject(new Error('Recording is no longer active.')); return }
        finishing = true
        rejectFinish = reject
        clearTimeout(timer)
        timer = setTimeout(() => fail(new Error('Microphone did not finish delivering samples.')), 5000)
        complete = () => {
          if (push) {
            void delivery!.finish().then(() => { cleanup(); resolve('') }, error => { cleanup(); reject(error) })
            return
          }
          try {
            if (length === 0) throw new Error('The microphone captured no audio samples.')
            const buffer = context.createBuffer(1, length, context.sampleRate)
            let offset = 0
            for (const chunk of chunks) { buffer.getChannelData(0).set(chunk, offset); offset += chunk.length }
            const bytes = encodeRecording(buffer)
            let binary = ''
            for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
            resolve(btoa(binary))
          } catch (error) { reject(error) } finally { cleanup() }
        }
        processor!.port.postMessage('finish')
      }),
    }
  } catch (error) { cleanup(); throw error }
}
