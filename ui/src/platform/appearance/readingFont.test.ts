import { describe, expect, it } from 'vitest'
import { readingFontForText } from './readingFont'

describe('configured reading font', () => {
  const faces = [
    { family: 'Arabic Face', unicodeRange: 'U+600-6FF, U+750-77F' },
    { family: 'Hindi Face', unicodeRange: 'U+900-97F' },
    { family: 'Malayalam Face', unicodeRange: 'U+D00-D7F' },
    { family: 'Chinese Face', unicodeRange: 'U+4E00-9FFF' },
    { family: 'Latin Face', unicodeRange: 'U+0-10FFFF' },
  ]
  const stack = faces.map(face => `'${face.family}'`).join(', ') + ', serif'

  it.each([
    ['العربية', 'Arabic Face'], ['हिन्दी', 'Hindi Face'],
    ['മലയാളം', 'Malayalam Face'], ['中文', 'Chinese Face'],
    ['Español', 'Latin Face'], ['Français', 'Latin Face'],
  ])('resolves %s through the current script ranges', (sample, expected) => {
    expect(readingFontForText(stack, sample, faces)).toBe(expected)
  })

  it('follows replacement fonts without a separate language-to-font mapping', () => {
    expect(readingFontForText('"New Arabic", serif', 'العربية', [
      { family: 'New Arabic', unicodeRange: 'U+6??' },
    ])).toBe('New Arabic')
  })
})
