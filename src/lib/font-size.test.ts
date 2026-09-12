import { describe, expect, it } from 'vitest'
import { applyFontSizeAction, fontSizeActionFromShortcut } from './font-size'

describe('font size actions', () => {
  it('changes size in the persisted reading-size increments and respects its bounds', () => {
    expect(applyFontSizeAction(100, 'increase')).toBe(105)
    expect(applyFontSizeAction(100, 'decrease')).toBe(95)
    expect(applyFontSizeAction(150, 'increase')).toBe(150)
    expect(applyFontSizeAction(75, 'decrease')).toBe(75)
    expect(applyFontSizeAction(75, 'reset')).toBe(100)
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
