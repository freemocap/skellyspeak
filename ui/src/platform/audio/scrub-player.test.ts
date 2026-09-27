// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createScrubPlayer } from './scrub-player'
import { beginCapture, endCapture, setPlaybackAllowed } from './speech'
import { getSpeechFollow } from './speech-follow'

function fixture(deferred = false) {
  let resolve!: (value: typeof buffer) => void
  const buffer = { duration: 1, sampleRate: 48000, numberOfChannels: 1, getChannelData: () => new Float32Array(48000) }
  const decode = deferred ? new Promise<typeof buffer>(done => { resolve = done }) : Promise.resolve(buffer)
  const gain = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }
  const context = { resume: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn(() => decode), audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
    createGain: () => gain, destination: {} }
  const node = { port: { postMessage: vi.fn(), close: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), onprocessorerror: null as (() => void) | null }
  vi.stubGlobal('AudioContext', vi.fn(function () { return context }))
  vi.stubGlobal('AudioWorkletNode', vi.fn(function () { return node }))
  return { context, node, gain, resolve: () => resolve(buffer) }
}
const ready = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }
afterEach(() => { setPlaybackAllowed(false); setPlaybackAllowed(true); vi.unstubAllGlobals() })

it('follows scrub movement in either direction and clears the reading highlight on release', async () => {
  fixture()
  const player = createScrubPlayer('AA==', vi.fn(), { text: 'go go' })
  player.start(0, 0)
  await ready()
  player.move(0.8, 20)
  expect(getSpeechFollow()?.word.start).toBe(3)
  player.move(0.2, 40)
  expect(getSpeechFollow()?.word.start).toBe(0)
  player.end()
  expect(getSpeechFollow()).toBeNull()
  player.dispose()
})

it('decodes once and sends positions to one connected worklet across gestures', async () => {
  const { context, node, gain } = fixture()
  const errors = vi.fn(), player = createScrubPlayer('AA==', errors)
  player.setVolume(0.4); player.start(0.2, 0)
  await ready()
  expect(node.port.postMessage.mock.calls[0][0].type).toBe('load')
  expect(node.port.postMessage).toHaveBeenLastCalledWith({ type: 'start', seconds: 0.2 })
  player.move(0.4, 20)
  expect(node.port.postMessage).toHaveBeenLastCalledWith({ type: 'move', seconds: 0.4, elapsed: 0.02 })
  expect(gain.gain.value).toBe(0.4)
  player.end(); expect(gain.gain.value).toBe(0)
  expect(node.port.postMessage).toHaveBeenLastCalledWith({ type: 'stop' })
  player.start(0.5, 50); player.move(0.6, 70)
  expect(context.decodeAudioData).toHaveBeenCalledOnce()
  expect(AudioWorkletNode).toHaveBeenCalledOnce()
  expect(node.connect).toHaveBeenCalledOnce()
  player.dispose()
  expect(node.port.close).toHaveBeenCalledOnce()
  expect(context.close).toHaveBeenCalledOnce()
  expect(errors).not.toHaveBeenCalled()
})

it('anchors fresh movement after decoding instead of replaying buffered gestures', async () => {
  const { node, resolve } = fixture(true)
  const player = createScrubPlayer('AA==', vi.fn())
  player.start(0, 0); player.move(0.8, 20)
  resolve(); await ready()
  expect(node.port.postMessage).toHaveBeenLastCalledWith({ type: 'start', seconds: 0.8 })
  expect(node.port.postMessage.mock.calls.some(([message]) => message.type === 'move')).toBe(false)
  player.move(0.9, 40)
  expect(node.port.postMessage).toHaveBeenLastCalledWith({ type: 'move', seconds: 0.9, elapsed: 0.02 })
  const token = beginCapture(); endCapture(token)
  player.move(1, 60)
  expect(node.port.postMessage).toHaveBeenLastCalledWith({ type: 'stop' })
  player.dispose()
})

it('cannot start a released gesture when decoding completes late', async () => {
  const { node, resolve, gain } = fixture(true)
  const player = createScrubPlayer('AA==', vi.fn())
  player.start(0, 0); player.move(0.5, 20); player.end()
  resolve(); await ready()
  expect(node.port.postMessage.mock.calls.every(([message]) => message.type === 'load')).toBe(true)
  expect(gain.gain.value).toBe(0)
  player.dispose()
})

it('surfaces worklet failures and silences output', async () => {
  const { node, gain } = fixture()
  const errors = vi.fn(), player = createScrubPlayer('AA==', errors)
  player.start(0); await ready()
  node.onprocessorerror!()
  expect(errors).toHaveBeenCalledOnce()
  expect(gain.gain.value).toBe(0)
  player.dispose()
})
