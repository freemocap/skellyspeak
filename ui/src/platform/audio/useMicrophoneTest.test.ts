// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMicrophoneTest } from './useMicrophoneTest'
import { microphoneHeld } from './speech'
const invoke = vi.hoisted(() => vi.fn())
const browser = vi.hoisted(() => vi.fn())
vi.mock('../ipc/native', () => ({ invoke }))
vi.mock('../diagnostics/faults', () => ({ reportFault: vi.fn() }))
vi.mock('./browser-recording', () => ({ startBrowserRecording: browser }))
beforeEach(() => {
  vi.useFakeTimers(); invoke.mockReset(); browser.mockReset()
  invoke.mockImplementation(async command => command === 'microphone_test_start'
    ? { browserCapture: false, deviceLabel: 'USB input' }
    : command === 'microphone_test_samples' ? [0.2, -0.2] : undefined)
})
afterEach(() => { vi.useRealTimers() })

it('does not capture on mount, shows actual input, and stops without uploading after 15 seconds', async () => {
  const { result } = renderHook(() => useMicrophoneTest(null))
  expect(invoke).not.toHaveBeenCalled()
  await act(async () => { await result.current.start() })
  expect(result.current.label).toBe('USB input')
  await act(async () => { await vi.advanceTimersByTimeAsync(200) })
  expect(result.current.health?.detected).toBe(true)
  await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
  expect(result.current.phase).toBe('idle')
  expect(microphoneHeld()).toBe(false)
  expect(invoke.mock.calls.every(([command]) => command.startsWith('microphone_test_'))).toBe(true)
})

it('serializes repeat starts and cleans up late startup after leaving', async () => {
  let ready!: (value: unknown) => void
  invoke.mockImplementation(command => command === 'microphone_test_start' ? new Promise(resolve => { ready = resolve }) : Promise.resolve())
  const { result, unmount } = renderHook(() => useMicrophoneTest(null))
  let pending!: Promise<void>
  act(() => { pending = result.current.start(); void result.current.start() })
  expect(result.current.phase).toBe('starting')
  expect(invoke).toHaveBeenCalledTimes(1)
  unmount()
  await act(async () => { ready({ browserCapture: false, deviceLabel: 'USB' }); await pending })
  expect(invoke).toHaveBeenCalledWith('microphone_test_stop', { testId: expect.any(String) })
  expect(microphoneHeld()).toBe(false)
})

it('stops browser capture when the selected device changes, without finishing a recording', async () => {
  invoke.mockResolvedValue({ browserCapture: true, deviceLabel: null })
  const capture = { deviceLabel: 'Headset', cancel: vi.fn(), finish: vi.fn(), wave: { read: () => [0.1] } }
  browser.mockResolvedValue(capture)
  const { result, rerender } = renderHook(({ device }) => useMicrophoneTest(device), { initialProps: { device: 'one' } })
  await act(async () => { await result.current.start() })
  expect(result.current.label).toBe('Headset')
  await act(async () => { rerender({ device: 'two' }) })
  expect(capture.cancel).toHaveBeenCalledOnce()
  expect(capture.finish).not.toHaveBeenCalled()
  expect(microphoneHeld()).toBe(false)
})

it('reports permission failure and permits retry', async () => {
  invoke.mockRejectedValueOnce(new Error('Permission denied'))
  const { result } = renderHook(() => useMicrophoneTest(null))
  await act(async () => { await result.current.start() })
  expect(result.current.error).toEqual(new Error('Permission denied'))
  expect(result.current.phase).toBe('idle')
  await act(async () => { await result.current.start(); await result.current.stop() })
  expect(microphoneHeld()).toBe(false)
})


it('keeps capture exclusion after a failed stop and lets the learner retry', async () => {
  const { result } = renderHook(() => useMicrophoneTest(null))
  await act(async () => { await result.current.start() })
  invoke.mockRejectedValueOnce(new Error('Stop unavailable'))
  await act(async () => { await result.current.stop() })
  expect(microphoneHeld()).toBe(true)
  expect(result.current.error).toEqual(new Error('Stop unavailable'))
  await act(async () => { await result.current.stop() })
  expect(microphoneHeld()).toBe(false)
})
