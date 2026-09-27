import { afterEach, expect, it, vi } from 'vitest'
import type { ScrubCommand } from './scrub-worklet'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

it('renders one stream through the actual processor messages and becomes silent at the endpoint', async () => {
  type Processor = {
    port: { onmessage: (event: { data: ScrubCommand }) => void }
    process: (input: Float32Array[][], output: Float32Array[][]) => boolean
  }
  let Constructor!: new () => Processor
  vi.stubGlobal('sampleRate', 48000)
  vi.stubGlobal('AudioWorkletProcessor', class { port = { onmessage: null } })
  vi.stubGlobal('registerProcessor', (name: string, constructor: new () => Processor) => {
    expect(name).toBe('skellyspeak-scrub'); Constructor = constructor
  })
  await import('./scrub-worklet')
  const processor = new Constructor()
  const send = (data: ScrubCommand) => processor.port.onmessage({ data })
  const output = [[new Float32Array(128), new Float32Array(128)]]
  send({ type: 'load', channels: [new Float32Array(48000).fill(0.25), new Float32Array(48000).fill(-0.5)], sourceRate: 48000 })
  send({ type: 'start', seconds: 0.1 })
  processor.process([], output)
  expect(output[0][0].every(value => value === 0)).toBe(true)
  send({ type: 'move', seconds: 0.2, elapsed: 0.016 })
  processor.process([], output)
  expect(Math.max(...output[0][0])).toBe(0.25)
  expect(Math.min(...output[0][1])).toBe(-0.5)
  // Updating the destination cannot add a second voice or double the amplitude.
  send({ type: 'move', seconds: 0.3, elapsed: 0.016 })
  for (let i = 0; i < 20; i++) {
    processor.process([], output)
    expect(Math.max(...output[0][0])).toBeLessThanOrEqual(0.25)
  }
  expect(output[0][0].every(value => value === 0)).toBe(true)
  send({ type: 'move', seconds: 0.4, elapsed: 0.016 })
  processor.process([], output)
  send({ type: 'stop' })
  processor.process([], output)
  expect(output[0].every(channel => channel.every(value => value === 0))).toBe(true)
})
