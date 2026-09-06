import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
function color(name: string): string {
  const match = css.match(new RegExp(`--${name}: (#[0-9a-f]{6})`))
  if (!match) throw new Error(`Missing palette color: ${name}`)
  return match[1]
}
function luminance(hex: string): number {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
}
function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y)
  return (values[1] + 0.05) / (values[0] + 0.05)
}
it('keeps shared secondary text readable on its dark and paper surfaces', () => {
  for (const text of ['ink-d', 'mut-d', 'faint-d']) {
    for (const background of ['bg', 'chrome', 'chrome2', 'inset']) {
      expect(contrast(color(text), color(background)), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5)
    }
  }
  for (const background of [color('paper'), color('paper2'), '#e9e5d8']) {
    expect(contrast(color('ink-mut'), background)).toBeGreaterThanOrEqual(4.5)
  }
  expect(contrast('#ffffff', color('steel-deep'))).toBeGreaterThanOrEqual(4.5)
})
