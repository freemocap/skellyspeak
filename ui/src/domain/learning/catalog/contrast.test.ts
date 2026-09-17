import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const tokens = readFileSync(new URL('../../../styles/foundations/tokens.css', import.meta.url), 'utf8')

// Resolve the default table and each explicit override independently: scanning
// the entire sheet as one map would silently test only the last theme.
const defaults = tokens.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1]
const dark = tokens.match(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/)?.[1]
if (!defaults || !dark) throw new Error('Missing theme tables')
function table(source: string) {
  return new Map([...source.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]))
}
const themes: Record<string, Map<string, string>> = {}
for (const theme of ['light', 'dark']) {
  for (const palette of ['cool', 'warm']) {
    const overrides = [...tokens.matchAll(/(:root[^{}]*)\{([^{}]*)\}/g)]
      .filter(([, selector]) => {
        const attrs = [...selector.matchAll(/data-([a-z]+)='([a-z_]+)'/g)]
        return attrs.length > 0 && attrs.every(([, key, value]) =>
          (key === 'theme' && value === theme) || (key === 'palette' && value === palette))
      })
      .map(([, , body]) => body).join('\n')
    themes[theme + '-' + palette] = table(defaults + overrides)
  }
}
const aliasPattern = /^var\(\s*--([\w-]+)\s*\)$/
function color(theme: keyof typeof themes, name: string, depth = 0): string {
  const value = themes[theme].get(name.match(aliasPattern)?.[1] ?? name)
  if (value === undefined) throw new Error('Missing palette color: ' + name)
  const alias = value.match(aliasPattern)
  if (alias) {
    if (depth > 10) throw new Error('Token cycle while resolving --' + name)
    return color(theme, alias[1], depth + 1)
  }
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Non-hex color: ' + name + ': ' + value)
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
for (const theme of Object.keys(themes)) {
  const c = (name: string) => color(theme, name)
  it(`keeps primary, secondary and action text readable in ${theme}`, () => {
    for (const text of ['ink', 'ink-2', 'ink-3']) {
      for (const background of ['bg', 'field', 'card', 'chrome', 'well-top', 'well-bottom']) {
        expect(contrast(c(text), c(background)), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const background of ['sheet', 'chrome', 'bubble-learner-bg', 'partner-top']) {
      expect(contrast(c('ink-3'), c(background))).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(c('ink-on-fill'), c('accent-strong'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(c('ink-on-fill'), c('accent-strong-hover'))).toBeGreaterThanOrEqual(4.5)
    for (const background of ['sheet', 'field', 'bubble-learner-bg', 'partner-top']) {
      expect(contrast(c('focus-accent'), c(background)), `focus on ${background}`).toBeGreaterThanOrEqual(3)
    }
    expect(contrast(c('danger-ink'), c('field'))).toBeGreaterThanOrEqual(4.5)
  })
  it(`keeps links, status, recovery and destructive controls readable in ${theme}`, () => {
    for (const ink of ['accent-ink', 'danger', 'danger-on-dark', 'success']) {
      for (const background of ['card', 'chrome', 'field']) {
        expect(contrast(c(ink), c(background)), `${ink} on ${background}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const background of ['danger-fill', 'danger-fill-hover', 'danger-on-dark-line']) {
      expect(contrast(c('ink-on-fill'), c(background)), `white on ${background}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it(`keeps evidence and XP badge text readable in ${theme}`, async () => {
    const { domainColors } = await import('./skill-domains')
    for (const domain of ['social', 'properties', 'reference', 'time', 'operators', 'connections']) {
      const palette = domainColors(domain)
      for (const background of ['sheet', 'bubble-learner-bg', 'card']) {
        expect(contrast(c(palette.ink), c(background)), `${domain} on ${background}`).toBeGreaterThanOrEqual(4.5)
      }
      expect(contrast(c('ink-on-domain'), c(palette.ink)), `${domain} XP badge`).toBeGreaterThanOrEqual(4.5)
    }
  })
}
