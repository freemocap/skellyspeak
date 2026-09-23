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
  // The strip paints with design tokens, and jsdom loads no stylesheet, so
  // declare the ones it reads.
  for (const [name, value] of [['--interaction-ink', '#6f9bff'], ['--field', '#0c1420'], ['--ink-on-fill', '#ffffff'], ['--warning-ink', '#e6b357'], ['--ink', '#e8eef7']])
    document.documentElement.style.setProperty(name, value)
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
  expect(context.lineTo).toHaveBeenCalledTimes(591)
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
  expect(context.lineTo.mock.calls.length).toBeLessThanOrEqual(10 * (2 * 590 + 1))
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

it('keeps delayed display history visible on the capture clock after a minute', () => {
  render(<WaveformStrip source={{ samplesPerSecond: 750, read: () => Array(9000).fill(0.25), endSeconds: () => 60 }}
    timelineSeconds={12} endSeconds={60} />)
  expect(context.moveTo).toHaveBeenCalledWith(0, expect.closeTo(44 * 0.05))
  const waveX = context.lineTo.mock.calls.slice(1, -1).map(([x]) => x)
  expect(Math.min(...waveX)).toBeGreaterThanOrEqual(0)
  expect(Math.max(...waveX)).toBeLessThanOrEqual(590)
})

it('retains only the visible history and preserves a one-sample peak', () => {
  const samples = Array(15000).fill(0)
  samples[samples.length - 2] = 1
  samples[samples.length - 1] = -1
  render(<WaveformStrip source={{ samplesPerSecond: 750, read: () => samples }} timelineSeconds={10} />)
  expect(context.lineTo.mock.calls.length).toBeLessThanOrEqual(1181)
  expect(context.lineTo).toHaveBeenCalledWith(7498 * 590 / 7500, 22 - 44 * 0.45)
  expect(context.lineTo).toHaveBeenCalledWith(7499 * 590 / 7500, 22 + 44 * 0.45)
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

it.each([44, 80])('fills the %ipx strip with quiet speech and rescales for louder incoming speech', height => {
  let samples = [0.02, -0.01]
  render(<WaveformStrip source={{ samplesPerSecond: 4, read: () => samples }} height={height} timelineSeconds={1} />)
  expect(context.moveTo).toHaveBeenCalledWith(295, expect.closeTo(height * 0.05))
  expect(context.lineTo).toHaveBeenCalledWith(442.5, expect.closeTo(height * 0.725))

  context.moveTo.mockClear()
  context.lineTo.mockClear()
  samples = [0.1, -0.1]
  advance(16)
  expect(context.moveTo).toHaveBeenCalledWith(0, expect.closeTo(height * 0.41))
  const ys = context.lineTo.mock.calls.slice(1, -1).map(([, y]) => y)
  expect(Math.min(...ys)).toBeCloseTo(height * 0.05)
  expect(Math.max(...ys)).toBeCloseTo(height * 0.95)
})

it.each([0, 0.0001])('keeps silence and very low noise near the center (%f)', level => {
  render(<WaveformStrip source={{ samplesPerSecond: 2, read: () => [level, -level] }} timelineSeconds={1} />)
  const waveY = context.lineTo.mock.calls[1]![1]
  expect(waveY).toBeGreaterThanOrEqual(22)
  expect(waveY).toBeLessThan(22.2)
})
