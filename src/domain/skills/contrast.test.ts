import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const tokens = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8')

/// Token name -> declared value. Reading the whole sheet rather than
/// pattern-matching one line lets a colour be followed through the alias chain
/// (--shell-text -> --c-ink-50), which is how the palette is written.
const declared = new Map<string, string>()
for (const match of tokens.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) declared.set(match[1], match[2].trim())

const aliasPattern = /^var\(\s*--([\w-]+)\s*\)$/

/// The colour a token actually renders as. Fails loudly when a token resolves
/// only to another token: contrast cannot be measured against an indirection.
function color(name: string, depth = 0): string {
  const value = declared.get(name)
  if (value === undefined) throw new Error('Missing palette color: ' + name)
  const alias = value.match(aliasPattern)
  if (alias) {
    if (depth > 10) throw new Error('Token cycle while resolving --' + name)
    return color(alias[1], depth + 1)
  }
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new Error('Token --' + name + ' does not resolve to a six-digit hex colour: ' + value)
  return value
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
  for (const text of ['shell-text', 'shell-text-muted', 'shell-text-faint']) {
    for (const background of ['shell-bg', 'shell-sunken', 'shell-well', 'shell-chrome', 'shell-overlay', 'shell-raised']) {
      expect(contrast(color(text), color(background)), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5)
    }
  }
  for (const background of [color('paper-bg'), color('paper-sunken'), '#e9e5d8']) {
    expect(contrast(color('paper-ink-muted'), background)).toBeGreaterThanOrEqual(4.5)
  }
  expect(contrast(color('ink-on-fill'), color('accent-strong'))).toBeGreaterThanOrEqual(4.5)
})

it('keeps domain evidence text and XP badge text readable without using domain colors as small dark-surface text', async () => {
  const { domainColors } = await import('./skill-domains')
  for (const domain of ['social', 'descriptions', 'statements', 'situating', 'questions', 'opinions']) {
    const palette = domainColors(domain)
    expect(contrast(palette.ink, color('paper-bg')), `${domain} on paper`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(palette.ink, color('bubble-learner-bg')), `${domain} on user bubble`).toBeGreaterThanOrEqual(4.5)
    expect(contrast(color('ink-on-fill'), palette.ink), `${domain} XP badge`).toBeGreaterThanOrEqual(4.5)
  }
})
