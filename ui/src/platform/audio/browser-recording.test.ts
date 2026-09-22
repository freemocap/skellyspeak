import { expect, it } from 'vitest'
import { encodeRecording } from './browser-recording'

it('encodes microphone samples as bounded mono PCM WAV', () => {
  const buffer = { duration: 0.001, length: 3, sampleRate: 48000, numberOfChannels: 2,
    getChannelData: () => new Float32Array([-1, 0, 1]) } as unknown as AudioBuffer
  const bytes = encodeRecording(buffer)
  const view = new DataView(bytes.buffer)
  expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF')
  expect(view.getUint16(22, true)).toBe(1)
  expect(view.getUint32(24, true)).toBe(48000)
  expect(view.getUint32(40, true)).toBe(6)
  expect([44, 46, 48].map(offset => view.getInt16(offset, true))).toEqual([-32768, 0, 32767])
})
it('rejects recordings exceeding the shared duration limit', () => {
  expect(() => encodeRecording({ duration: 121 } as AudioBuffer)).toThrow('duration')
})

it('finishes consecutive captures as WAV and releases their tracks and contexts', async () => {
  const { vi } = await import('vitest')
  const { startBrowserRecording } = await import('./browser-recording')
  const captures: { port: { onmessage: ((event: { data: Float32Array | string }) => void) | null; postMessage: (value: string) => void; close: () => void } }[] = []
  const stops: ReturnType<typeof vi.fn>[] = []
  const closes: ReturnType<typeof vi.fn>[] = []
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => {
    const stop = vi.fn(); stops.push(stop)
    return { getTracks: () => [{ stop }] }
  } } })
  vi.stubGlobal('AudioContext', class {
    sampleRate = 48000
    close = vi.fn().mockResolvedValue(undefined)
    constructor() { closes.push(this.close) }
    audioWorklet = { addModule: async () => {} }
    resume = async () => {}
    createAnalyser = () => ({ fftSize: 2048, getFloatTimeDomainData: () => {} })
    createMediaStreamSource = () => ({ connect: () => {}, disconnect: () => {} })
    createBuffer = (_channels: number, length: number, sampleRate: number) => {
      const data = new Float32Array(length)
      return { length, sampleRate, duration: length / sampleRate, numberOfChannels: 1,
        copyToChannel: (chunk: Float32Array, _channel: number, offset: number) => data.set(chunk, offset), getChannelData: () => data }
    }
  })
  vi.stubGlobal('AudioWorkletNode', class {
    port = { onmessage: null as ((event: { data: Float32Array | string }) => void) | null,
      postMessage: () => { this.port.onmessage?.({ data: 'finished' }) }, close: () => {} }
    constructor() { captures.push(this) }
    connect() {}
    disconnect() {}
  })
  try {
    const onError = vi.fn()
    for (const sample of [0.25, -0.5, 0.75]) {
      const recording = await startBrowserRecording(onError)
      captures.at(-1)!.port.onmessage!({ data: new Float32Array([sample]) })
      const bytes = Uint8Array.from(atob(await recording.finish()), char => char.charCodeAt(0))
      expect(new DataView(bytes.buffer).getInt16(44, true)).toBe(Math.round(sample * (sample < 0 ? 32768 : 32767)))
    }
    expect(stops).toHaveLength(3)
    for (const stop of stops) expect(stop).toHaveBeenCalledOnce()
    for (const close of closes) expect(close).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  } finally { vi.unstubAllGlobals() }
})
