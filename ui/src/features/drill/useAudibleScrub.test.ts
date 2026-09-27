// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAudibleScrub } from './useAudibleScrub'

const factory = vi.hoisted(() => vi.fn())
vi.mock('../../platform/audio/scrub-player', () => ({ createScrubPlayer: factory }))
beforeEach(() => factory.mockReset().mockImplementation(() => ({ start: vi.fn(), move: vi.fn(), end: vi.fn(), dispose: vi.fn(), setVolume: vi.fn() })))

it('passes exact source positions and pointer timestamps to the drag player', () => {
  const { result } = renderHook(() => useAudibleScrub('audio', true, false, 0.5, vi.fn()))
  const player = factory.mock.results[0].value
  act(() => { result.current.start(2, 1000); result.current.move(1.98, 1020); result.current.end() })
  expect(player.start).toHaveBeenCalledWith(2, 1000)
  expect(player.move).toHaveBeenCalledWith(1.98, 1020)
  expect(player.end).toHaveBeenCalledOnce()
  expect(player.setVolume).toHaveBeenCalledWith(0.5)
})

it('pauses pre-existing playback immediately and gives movement to the preview', () => {
  const pause = vi.fn()
  const { result } = renderHook(() => useAudibleScrub('audio', true, true, 1, vi.fn(), pause))
  act(() => result.current.start(1))
  expect(pause).toHaveBeenCalledOnce()
  expect(factory.mock.results[0].value.move).not.toHaveBeenCalled()
  act(() => result.current.move(2))
  expect(factory.mock.results[0].value.start).toHaveBeenCalledWith(1, undefined)
  expect(factory.mock.results[0].value.move).toHaveBeenCalledWith(2, undefined)
  expect(pause).toHaveBeenCalledOnce()
  act(() => { result.current.end(); result.current.end() })
  expect(pause).toHaveBeenCalledTimes(2)
})

it('disposes source audio on changes, capture and unmount', () => {
  const { result, rerender, unmount } = renderHook(({ enabled, audio }) => useAudibleScrub(audio, enabled, false, 1, vi.fn()), {
    initialProps: { enabled: true, audio: 'first' },
  })
  act(() => result.current.start(1))
  const first = factory.mock.results[0].value
  rerender({ enabled: true, audio: 'second' })
  expect(first.dispose).toHaveBeenCalledOnce()
  const second = factory.mock.results[1].value
  rerender({ enabled: false, audio: 'second' })
  expect(second.dispose).toHaveBeenCalledOnce()
  rerender({ enabled: true, audio: 'third' })
  const third = factory.mock.results[2].value
  unmount()
  expect(third.dispose).toHaveBeenCalledOnce()
})
