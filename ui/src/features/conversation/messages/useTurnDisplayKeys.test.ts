// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useTurnDisplayKeys } from './useTurnDisplayKeys'

it('keeps a revision chain in its original display slot, including when ancestors leave the loaded page', () => {
  const hook = renderHook(({ chat, turns }) => useTurnDisplayKeys(chat, turns), { initialProps: { chat: 'a', turns: [{ turnId: 'one', replacesTurnId: null as string | null }] } })
  hook.rerender({ chat: 'a', turns: [{ turnId: 'two', replacesTurnId: 'one' }] })
  expect(hook.result.current.get('two')).toBe('one')
  hook.rerender({ chat: 'a', turns: [{ turnId: 'three', replacesTurnId: 'two' }] })
  expect(hook.result.current.get('three')).toBe('one')
  hook.rerender({ chat: 'b', turns: [{ turnId: 'three', replacesTurnId: null }] })
  expect(hook.result.current.get('three')).toBe('three')
  expect(hook.result.current.has('one')).toBe(false)
})
