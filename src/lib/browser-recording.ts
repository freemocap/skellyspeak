import type { WaveSource } from '../components/WaveformStrip'

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

export async function startBrowserRecording(onError: (error: Error) => void): Promise<BrowserRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  let context: AudioContext | undefined
  let recorder: MediaRecorder | undefined
  let rejectFinish: ((error: Error) => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const cleanup = () => { clearTimeout(timer); stream.getTracks().forEach(track => track.stop()); if (context && context.state !== 'closed') void context.close().catch(onError) }
  const cancel = () => { if (recorder) { recorder.onstop = null; if (recorder.state !== 'inactive') recorder.stop() }; cleanup() }
  try {
    context = new AudioContext()
    await context.resume()
    const analyser = context.createAnalyser(); analyser.fftSize = 2048
    context.createMediaStreamSource(stream).connect(analyser)
    const frame = new Float32Array(analyser.fftSize)
    recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    let size = 0
    recorder.ondataavailable = event => {
      size += event.data.size
      if (size > 16 * 1024 * 1024) { const error = new Error('Recording exceeds its size limit.'); cancel(); rejectFinish?.(error); onError(error); return }
      chunks.push(event.data)
    }
    recorder.onerror = () => { cancel(); onError(new Error('Mobile microphone capture failed.')) }
    recorder.start(1000)
    timer = setTimeout(() => { cancel(); onError(new Error('Recording exceeded two minutes. Please record a shorter message.')) }, 120000)
    const capture = recorder
    const audioContext = context
    return {
      cancel,
      wave: { samplesPerSecond: 60 * analyser.fftSize / 10, read: () => { analyser.getFloatTimeDomainData(frame); return Array.from(frame).filter((_, i) => i % 10 === 0) } },
      finish: () => new Promise<string>((resolve, reject) => {
        rejectFinish = reject
        if (capture.state === 'inactive') { cleanup(); reject(new Error('Recording is no longer active.')); return }
        clearTimeout(timer)
        capture.onerror = () => { cleanup(); reject(new Error('Mobile microphone capture failed.')) }
        capture.onstop = () => {
          stream.getTracks().forEach(track => track.stop())
          void new Blob(chunks, { type: capture.mimeType }).arrayBuffer()
            .then(data => audioContext.decodeAudioData(data))
            .then(buffer => {
              const bytes = encodeRecording(buffer)
              let binary = ''
              for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
              resolve(btoa(binary))
            }).catch(reject).finally(cleanup)
        }
        capture.stop()
      }),
    }
  } catch (error) { cancel(); throw error }
}
