// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useConversationScroll } from './useConversationScroll'

function stream(initial: number) {
  const node = document.createElement('div')
  let height = initial
  Object.defineProperty(node, 'scrollHeight', { get: () => height })
  Object.defineProperty(node, 'clientHeight', { value: 200 })
  return { node, ref: { current: node }, grow: (next: number) => { height = next } }
}

it('anchors prepended history and does not drag an older reader to the live tail', () => {
  const { node, ref, grow } = stream(1000)
  const hook = renderHook(({ first, revision }) => useConversationScroll(ref, 'chat', first, revision, 'tail'), { initialProps: { first: 101, revision: 1 } })
  node.scrollTop = 40
  act(() => hook.result.current.onScroll())
  grow(2000)
  hook.rerender({ first: 1, revision: 2 })
  expect(node.scrollTop).toBe(1040)
  grow(2200)
  hook.rerender({ first: 1, revision: 3 })
  expect(node.scrollTop).toBe(1040)
  node.scrollTop = 2000
  act(() => hook.result.current.onScroll())
  grow(2300)
  hook.rerender({ first: 1, revision: 4 })
  expect(node.scrollTop).toBe(2300)
})

it('reports a new tail to an earlier reader without moving them, and jumps on request', () => {
  const { node, ref, grow } = stream(1000)
  const hook = renderHook(({ tail, revision }) => useConversationScroll(ref, 'chat', 1, revision, tail), { initialProps: { tail: '1:reply', revision: 1 } })
  expect(hook.result.current.unseen).toBe(false)
  node.scrollTop = 100
  act(() => hook.result.current.onScroll())
  grow(1200)
  hook.rerender({ tail: '1:reply', revision: 2 })
  expect(hook.result.current.unseen).toBe(false)
  hook.rerender({ tail: '2:pending', revision: 3 })
  expect(node.scrollTop).toBe(100)
  expect(hook.result.current.unseen).toBe(true)
  act(() => hook.result.current.jumpToLatest())
  expect(node.scrollTop).toBe(1200)
  expect(hook.result.current.unseen).toBe(false)
})
