// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useReplyReveal } from './useReplyReveal'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it('reveals a burst progressively, catches up within 800 ms, and never rewrites source text', () => {
  vi.useFakeTimers()
  const hook = renderHook(({ text }) => useReplyReveal(text, true), { initialProps: { text: '' } })
  const text = 'Hello  world!\nالبيوت cafe\u0301 中文 👩🏽‍💻 ' + 'more '.repeat(120)
  hook.rerender({ text })
  expect(hook.result.current.text).not.toBe('')
  expect(hook.result.current.revealing).toBe(true)
  act(() => vi.advanceTimersByTime(200))
  expect(text.startsWith(hook.result.current.text)).toBe(true)
  expect(hook.result.current.revealing).toBe(true)
  act(() => vi.advanceTimersByTime(600))
  expect(hook.result.current).toEqual({ text, revealing: false })
  expect(vi.getTimerCount()).toBe(0)
})

it('continues through incoming deltas and final publication without replaying the prefix', () => {
  vi.useFakeTimers()
  const hook = renderHook(({ text }) => useReplyReveal(text, true), { initialProps: { text: '' } })
  hook.rerender({ text: 'One two three' })
  act(() => vi.advanceTimersByTime(40))
  const prefix = hook.result.current.text
  hook.rerender({ text: 'One two three four five' })
  expect(hook.result.current.text.startsWith(prefix)).toBe(true)
  act(() => vi.advanceTimersByTime(800))
  hook.rerender({ text: 'One two three four five' })
  expect(hook.result.current.revealing).toBe(false)
})

it('does not replay history, replacements, or terminal retained text', () => {
  vi.useFakeTimers()
  const hook = renderHook(({ text, animate }) => useReplyReveal(text, animate), { initialProps: { text: 'Saved history', animate: true } })
  expect(hook.result.current.text).toBe('Saved history')
  hook.rerender({ text: 'Different source', animate: true })
  expect(hook.result.current.text).toBe('Different source')
  hook.rerender({ text: 'Different source with a long tail', animate: false })
  expect(hook.result.current.revealing).toBe(false)
  hook.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('keeps a combining sequence and joined emoji intact when a delta extends the visible prefix', () => {
  vi.useFakeTimers()
  const hook = renderHook(({ text }) => useReplyReveal(text, true), { initialProps: { text: 'cafe' } })
  hook.rerender({ text: 'cafe\u0301 👩🏽‍💻 中文 المزيد' })
  const boundaries = new Set([...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment('cafe\u0301 👩🏽‍💻 中文 المزيد')].map(part => part.index))
  expect(boundaries.has(hook.result.current.text.length)).toBe(true)
  expect(hook.result.current.text).toContain('cafe\u0301')
})

it('shows available text immediately with reduced motion', () => {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  const hook = renderHook(({ text }) => useReplyReveal(text, true), { initialProps: { text: '' } })
  hook.rerender({ text: 'All received words are visible.' })
  expect(hook.result.current).toEqual({ text: 'All received words are visible.', revealing: false })
})
