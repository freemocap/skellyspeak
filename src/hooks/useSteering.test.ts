// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { STEER_LEVELS, useSteering } from './useSteering'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

it.each(STEER_LEVELS)('restores $value after remounting', ({ value }) => {
  const first = renderHook(() => useSteering())
  act(() => first.result.current.setLevel(value))
  expect(localStorage.getItem('skellyspeak_level')).toBe(value)
  first.unmount()
  const second = renderHook(() => useSteering())
  expect(second.result.current.level).toBe(value)
})

it('defaults to beginner only when no selection is stored', () => {
  expect(renderHook(() => useSteering()).result.current.level).toBe('beginner')
})

it('reports storage failure without claiming the selection was saved', () => {
  const hook = renderHook(() => useSteering())
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage unavailable') })
  expect(() => act(() => hook.result.current.setLevel('advanced'))).toThrow('Storage unavailable')
  expect(hook.result.current.level).toBe('beginner')
})
