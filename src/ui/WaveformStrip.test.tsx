// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest'
import { WaveformStrip } from './WaveformStrip'

let now: number
let frames: Map<number, FrameRequestCallback>
let frameId: number
const context = { setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillText: vi.fn() }
beforeEach(() => {
  now = 0; frames = new Map(); frameId = 0
  vi.clearAllMocks()
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  // `getContext` is overloaded and ends with the WebGPU signature, so a bare
  // spyOn infers GPUCanvasContext. Narrow the spy to the 2D signature that
  // WaveformStrip actually calls.
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext') as unknown as MockInstance<(id: string) => CanvasRenderingContext2D | null>
  getContext.mockReturnValue(context as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(590)
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { frames.delete(id) }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function advance(milliseconds: number) {
  now = milliseconds
  const current = [...frames.values()]
  frames.clear()
  act(() => { current.forEach(callback => callback(now)) })
}

it('polls without redrawing unchanged history, but updates the elapsed second', () => {
  let reads = 0
  render(<WaveformStrip source={{ samplesPerSecond: 750, read: () => reads++ === 0 ? Array(7500).fill(0.25) : [] }} timelineSeconds={10} />)
  for (let i = 1; i < 60; i++) advance(i * 1000 / 60)
  expect(reads).toBe(60)
  expect(context.fillRect).toHaveBeenCalledTimes(1)
  expect(context.lineTo).toHaveBeenCalledTimes(7501)
  advance(1000)
  expect(context.fillRect).toHaveBeenCalledTimes(2)
  expect(context.fillText).toHaveBeenLastCalledWith('● rec 1s', 6, 12)
  expect(frames.size).toBe(1)
})

it('paints every incoming batch at 10Hz without extra paints between batches', () => {
  let reads = 0
  render(<WaveformStrip source={{ samplesPerSecond: 750, read: () => { const index = reads++; return index === 0 ? Array(7500).fill(0.25) : index % 6 === 0 ? Array(75).fill(-0.25) : [] } }} timelineSeconds={10} />)
  for (let i = 1; i < 60; i++) advance(i * 1000 / 60)
  expect(reads).toBe(60)
  expect(context.fillRect).toHaveBeenCalledTimes(10)
  expect(context.lineTo).toHaveBeenCalledTimes(75010)
})

it('repaints after resize even without incoming samples or a new elapsed second', () => {
  render(<WaveformStrip source={{ samplesPerSecond: 750, read: () => [] }} />)
  advance(16)
  expect(context.fillRect).toHaveBeenCalledTimes(1)
  act(() => window.dispatchEvent(new Event('resize')))
  advance(32)
  expect(context.fillRect).toHaveBeenCalledTimes(2)
  expect(context.setTransform).toHaveBeenCalledTimes(2)
})

it('retains only the visible history and preserves a one-sample peak', () => {
  const samples = Array(15000).fill(0)
  samples[samples.length - 2] = 1
  samples[samples.length - 1] = -1
  render(<WaveformStrip source={{ samplesPerSecond: 750, read: () => samples }} timelineSeconds={10} />)
  expect(context.lineTo).toHaveBeenCalledTimes(7501)
  expect(context.lineTo).toHaveBeenCalledWith(590 - 2 * 590 / 7500, 22 - 44 * 0.45)
  expect(context.lineTo).toHaveBeenCalledWith(590 - 590 / 7500, 22 + 44 * 0.45)
})

it('replaces the source without retaining old samples or leaking frames/listeners', () => {
  const oldRead = vi.fn().mockReturnValue(Array(100).fill(1))
  const nextRead = vi.fn().mockReturnValue([0, -1])
  const view = render(<WaveformStrip source={{ samplesPerSecond: 750, read: oldRead }} />)
  context.lineTo.mockClear()
  view.rerender(<WaveformStrip source={{ samplesPerSecond: 750, read: nextRead }} />)
  expect(context.lineTo).toHaveBeenCalledTimes(3)
  expect(frames.size).toBe(1)
  advance(16)
  expect(oldRead).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(frames.size).toBe(0)
  const reads = nextRead.mock.calls.length
  const transforms = context.setTransform.mock.calls.length
  advance(32)
  window.dispatchEvent(new Event('resize'))
  expect(nextRead).toHaveBeenCalledTimes(reads)
  expect(context.setTransform).toHaveBeenCalledTimes(transforms)
})
