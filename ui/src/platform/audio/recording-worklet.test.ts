import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

it('flushes the last PCM samples before finish and isolates successive recordings', async () => {
  type Processor = { port: { onmessage: (event: { data: string }) => void; postMessage: ReturnType<typeof vi.fn> }; process: (input: Float32Array[][]) => boolean }
  let Constructor!: new () => Processor
  vi.stubGlobal('AudioWorkletProcessor', class { port = { onmessage: null, postMessage: vi.fn() } })
  vi.stubGlobal('registerProcessor', (_name: string, value: new () => Processor) => { Constructor = value })
  await import('./recording-worklet')
  for (const sample of [0.25, -0.5, 0.75]) {
    const capture = new Constructor()
    capture.process([[new Float32Array(2200).fill(sample), new Float32Array(2200).fill(sample)]])
    capture.port.onmessage({ data: 'finish' })
    const messages = capture.port.postMessage.mock.calls.map(([data]) => data)
    expect(messages[0]).toEqual(new Float32Array(2048).fill(sample))
    expect(messages[1]).toEqual(new Float32Array(152).fill(sample))
    expect(messages[2]).toBe('finished')
    expect(capture.process([[new Float32Array([1])]])).toBe(false)
    capture.port.onmessage({ data: 'finish' })
    expect(capture.port.postMessage).toHaveBeenCalledTimes(3)
  }
})
