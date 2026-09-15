// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useConversationScroll } from './useConversationScroll'
it('anchors prepended history and does not drag an older reader to the live tail', () => {
  const node = document.createElement('div')
  let height = 1000
  Object.defineProperty(node, 'scrollHeight', { get: () => height })
  Object.defineProperty(node, 'clientHeight', { value: 200 })
  const ref = { current: node }
  const hook = renderHook(({ first, revision }) => useConversationScroll(ref, 'chat', first, revision), { initialProps: { first: 101, revision: 1 } })
  node.scrollTop = 40
  hook.result.current()
  height = 2000
  hook.rerender({ first: 1, revision: 2 })
  expect(node.scrollTop).toBe(1040)
  height = 2200
  hook.rerender({ first: 1, revision: 3 })
  expect(node.scrollTop).toBe(1040)
  node.scrollTop = 2000
  hook.result.current()
  height = 2300
  hook.rerender({ first: 1, revision: 4 })
  expect(node.scrollTop).toBe(2300)
})
