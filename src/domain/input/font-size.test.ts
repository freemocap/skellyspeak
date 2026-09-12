import { describe, expect, it } from 'vitest'
import { TEXT_SIZE } from '../../contracts'
import { applyFontSizeAction, fontSizeActionFromShortcut } from './font-size'

describe('font size actions', () => {
  it('changes size in the persisted reading-size increments and respects its bounds', () => {
    expect(applyFontSizeAction(100, 'increase')).toBe(100 + TEXT_SIZE.step)
    expect(applyFontSizeAction(100, 'decrease')).toBe(100 - TEXT_SIZE.step)
    expect(applyFontSizeAction(TEXT_SIZE.max, 'increase')).toBe(TEXT_SIZE.max)
    expect(applyFontSizeAction(TEXT_SIZE.min, 'decrease')).toBe(TEXT_SIZE.min)
    expect(applyFontSizeAction(TEXT_SIZE.min, 'reset')).toBe(TEXT_SIZE.default)
    expect(TEXT_SIZE.default).toBe(85)
  })

  it.each([
    [{ key: '+', code: 'Equal', metaKey: true }, 'increase'],
    [{ key: '=', code: 'Equal', ctrlKey: true }, 'increase'],
    [{ key: '-', code: 'Minus', ctrlKey: true }, 'decrease'],
    [{ key: '0', code: 'Digit0', metaKey: true }, 'reset'],
    [{ key: '+', code: 'Equal', ctrlKey: true, altKey: true }, null],
    [{ key: '+', code: 'Equal' }, null],
  ] as const)('recognizes %o as %s', (event, action) => {
    expect(fontSizeActionFromShortcut({ ctrlKey: false, metaKey: false, altKey: false, ...event })).toBe(action)
  })
})
