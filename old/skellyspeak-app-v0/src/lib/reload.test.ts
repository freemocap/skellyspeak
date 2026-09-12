import { describe, expect, it } from 'vitest'
import { isReloadShortcut } from './reload'

function key(key: string, modifiers: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>> = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...modifiers }
}

describe('reload shortcut', () => {
  it('accepts either platform modifier with R', () => {
    expect(isReloadShortcut(key('r', { ctrlKey: true }))).toBe(true)
    expect(isReloadShortcut(key('R', { metaKey: true }))).toBe(true)
  })

  it('does not take another modifier combination', () => {
    expect(isReloadShortcut(key('r'))).toBe(false)
    expect(isReloadShortcut(key('r', { altKey: true }))).toBe(false)
    expect(isReloadShortcut(key('r', { ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(isReloadShortcut(key('l', { ctrlKey: true }))).toBe(false)
  })
})
