import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { scrubErrorText } from './error-details'
const cases = JSON.parse(readFileSync(new URL('../../../../content/diagnostics/retention-cases.json', import.meta.url), 'utf8')) as { name: string; text: string; private: string[]; kept: string[]; removed: string[]; tag?: string }[]
for (const sample of cases) it(sample.name, () => {
  const result = scrubErrorText(sample.text, sample.private)
  for (const value of sample.kept) expect(result).toContain(value)
  for (const value of sample.removed) expect(result).not.toContain(value)
  if (sample.tag) expect(result).toContain(sample.tag)
  expect(scrubErrorText(result, sample.private)).toBe(result)
})
