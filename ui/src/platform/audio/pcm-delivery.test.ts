import { afterEach, expect, it, vi } from 'vitest'
import { PcmDelivery } from './pcm-delivery'
import { errorDetails } from '../diagnostics/error-details'

afterEach(() => vi.useRealTimers())

it('sustains 48kHz capture when IPC acknowledgements are slower than individual worklet frames', async () => {
  vi.useFakeTimers()
  const received: number[] = []
  const sequences: number[] = []
  const sizes: number[] = []
  const fail = vi.fn()
  const delivery = new PcmDelivery(48000, async (samples, rate, sequence) => {
    expect(rate).toBe(48000)
    sizes.push(samples.length); sequences.push(sequence); received.push(...samples)
    await new Promise(resolve => setTimeout(resolve, 90))
  }, fail)
  for (let frame = 0; frame < 500; frame++) {
    delivery.enqueue(new Float32Array(2048).fill(frame / 512))
    await vi.advanceTimersByTimeAsync(2048 / 48)
  }
  await vi.runAllTimersAsync()
  await delivery.finish()
  expect(fail).not.toHaveBeenCalled()
  expect(received).toHaveLength(500 * 2048)
  for (let frame = 0; frame < 500; frame++) {
    expect(received[frame * 2048]).toBe(frame / 512)
    expect(received[(frame + 1) * 2048 - 1]).toBe(frame / 512)
  }
  expect(Math.max(...sizes)).toBeLessThanOrEqual(8192)
  expect(sizes.some(size => size > 2048)).toBe(true)
  expect(sequences).toEqual(sequences.map((_, i) => i))
})

it('fails explicitly on sustained backlog and never sends queued audio after cancellation', async () => {
  let acknowledge!: () => void
  const push = vi.fn(() => new Promise<void>(resolve => { acknowledge = resolve }))
  const fail = vi.fn()
  const delivery = new PcmDelivery(8000, push, fail)
  delivery.enqueue(new Float32Array(8000))
  delivery.enqueue(new Float32Array(8000))
  delivery.enqueue(new Float32Array(1))
  expect(fail).toHaveBeenCalledOnce()
  expect(fail.mock.calls[0][0].diagnostics.pendingSamples).toBe(16001)
  const retained = JSON.stringify(errorDetails(fail.mock.calls[0][0]))
  expect(retained).toContain('browser_pcm_delivery')
  expect(retained).toContain('16001')
  expect(retained).toContain('sampleRate')
  acknowledge()
  await expect(delivery.finish()).rejects.toThrow('fell behind')
  expect(push).toHaveBeenCalledOnce()
})

it('retains a rejected native delivery and does not report a successful flush', async () => {
  const error = new Error('Native capture rejected the batch')
  const fail = vi.fn()
  const delivery = new PcmDelivery(48000, async () => { throw error }, fail)
  delivery.enqueue(new Float32Array([0.25]))
  await expect(delivery.finish()).rejects.toBe(error)
  expect(fail).toHaveBeenCalledWith(error)
})
