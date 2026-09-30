import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createSpeechStreamPlayer } from './speech-stream-player'
import { interruptSpeech, setPlaybackAllowed } from './speech'

const mock = vi.hoisted(() => ({ context: null as unknown as AudioContext }))
vi.mock('./speech-context', () => ({ speechContext: () => mock.context }))
let clock: number
let buffers: Float32Array[]
let sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[]
beforeEach(() => {
  vi.useFakeTimers(); setPlaybackAllowed(true); interruptSpeech()
  clock = 0; buffers = []; sources = []
  mock.context = {
    get currentTime() { return clock }, state: 'running', destination: {}, resume: vi.fn().mockResolvedValue(undefined),
    createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
    createBuffer: (_channels: number, length: number) => ({ copyToChannel: (data: Float32Array) => { expect(data.length).toBe(length); buffers.push(data.slice()) } }),
    createBufferSource: () => { const node = { start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), connect: vi.fn(), buffer: null, onended: null }; sources.push(node); return node },
  } as unknown as AudioContext
})
afterEach(() => { interruptSpeech(); vi.useRealTimers() })
function advance(ms: number) { for (let i = 0; i < ms; i += 20) { clock += 0.02; vi.advanceTimersByTime(20) } }
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
function audio(samples = 12000) {
  const bytes = new Uint8Array(samples * 2)
  new DataView(bytes.buffer).setInt16(0, 1000, true)
  const wav = new Uint8Array(44 + bytes.length)
  const v = new DataView(wav.buffer)
  const tag = (offset: number, text: string) => [...text].forEach((c, i) => { wav[offset + i] = c.charCodeAt(0) })
  tag(0, 'RIFF'); tag(8, 'WAVE'); tag(12, 'fmt '); tag(36, 'data')
  v.setUint32(4, wav.length - 8, true); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 24000, true); v.setUint32(28, 48000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); v.setUint32(40, bytes.length, true)
  wav.set(bytes, 44)
  return { bytes, complete: { audioBase64: encode(wav), alignment: null } }
}

it('plays before completion, waits through an underrun, then finishes without repeating the prefix', async () => {
  const fixture = audio(); const end = vi.fn(); const playing = vi.fn(); const time = vi.fn(); const error = vi.fn()
  const player = createSpeechStreamPlayer(end, error, 1, 1, { onPlaying: playing, onTime: time })
  await player.play()
  expect(sources).toHaveLength(0)
  player.append(encode(fixture.bytes.subarray(0, 9600)), 0)
  expect(sources.length).toBeGreaterThan(0)
  expect(playing).not.toHaveBeenCalledWith(true)
  advance(60); expect(playing).toHaveBeenLastCalledWith(true)
  expect(end).not.toHaveBeenCalled()
  advance(400); expect(playing).toHaveBeenLastCalledWith(false)
  const heldTime = time.mock.lastCall![0]
  advance(100); expect(time.mock.lastCall![0]).toBe(heldTime)
  player.finish(fixture.complete)
  advance(1000)
  expect(end).toHaveBeenCalledOnce(); expect(error).not.toHaveBeenCalled()
  expect(buffers.reduce((sum, buffer) => sum + buffer.length, 0)).toBe(12000)
  expect(buffers[0][0]).toBe(1000 / 32768)
})

it('schedules queued buffers contiguously and stops every source on interruption', async () => {
  const fixture = audio(); const end = vi.fn()
  const player = createSpeechStreamPlayer(end, vi.fn())
  await player.play(); player.append(encode(fixture.bytes), 0)
  const starts = sources.map(node => node.start.mock.calls[0][0] as number)
  starts.slice(1).forEach((start, i) => expect(start - starts[i]).toBeCloseTo(0.02, 8))
  interruptSpeech()
  expect(end).toHaveBeenCalledOnce()
  sources.forEach(node => expect(node.stop).toHaveBeenCalledOnce())
  const count = sources.length
  player.append(encode(fixture.bytes), 0); player.finish(fixture.complete); await player.play(); advance(1000)
  expect(sources).toHaveLength(count)
})

it('rejects a different completed recording and an out-of-order chunk', async () => {
  const fixture = audio(); const player = createSpeechStreamPlayer(vi.fn(), vi.fn())
  await player.play(); player.append(encode(fixture.bytes.subarray(0, 1000)), 0)
  expect(() => player.append('AAA=', 10)).toThrow('sequence')
  const wrong = audio(); wrong.bytes[0] = 0
  // Feed an independently valid WAV with a different first sample.
  const bytes = Uint8Array.from(atob(wrong.complete.audioBase64), c => c.charCodeAt(0)); bytes[44] = 0
  expect(() => player.finish({ audioBase64: encode(bytes) })).toThrow('does not match')
  player.stop()
})
