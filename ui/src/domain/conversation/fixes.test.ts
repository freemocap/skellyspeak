import { expect, it } from 'vitest'
import { fixCount } from './fixes'

const turns = [
  { id: 'first', replacesTurnId: null },
  { id: 'second', replacesTurnId: 'first' },
  { id: 'third', replacesTurnId: 'second' },
  { id: 'other', replacesTurnId: null },
]

it('counts the fixes behind a message: each revision sent in place of the one before', () => {
  expect(fixCount('first', turns)).toBe(0)
  expect(fixCount('second', turns)).toBe(1)
  expect(fixCount('third', turns)).toBe(2)
  expect(fixCount('other', turns)).toBe(0)
  expect(fixCount(undefined, turns)).toBe(0)
})

it('counts a replaced turn older than the loaded window, then stops', () => {
  expect(fixCount('late', [{ id: 'late', replacesTurnId: 'unloaded' }])).toBe(1)
})

it('never loops on a malformed chain', () => {
  expect(fixCount('a', [{ id: 'a', replacesTurnId: 'b' }, { id: 'b', replacesTurnId: 'a' }])).toBe(2)
})
