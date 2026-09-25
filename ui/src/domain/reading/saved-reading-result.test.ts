import { expect, it } from 'vitest'
import type { ReadingInput, SavedGlossSource } from '../../generated/contracts'
import { savedGlossQuery, savedReadingResult } from './saved-reading-result'

const scope = { language: 'spanish', variety: 'spain', explanation: 'english', explanationVariety: 'us' }
const source = (text: string, gloss: string, start = 0, end = text.length): SavedGlossSource => ({
  sourceId: `source-${gloss}`, operationId: 'operation', attemptId: 'attempt', scope, text,
  segments: [{ start, end, kind: 'gloss', gloss }],
})

it('projects alternatives with original receipt IDs, keeping source content out of the lookup receipt', () => {
  const result = savedReadingResult('Otra playa.', [source('La playa.', 'beach', 3, 8), source('playa', 'shore')])!
  expect(result.gloss).toEqual({ coverage: 'partial', segments: [{ start: 5, end: 10, kind: 'gloss', gloss: 'beach / shore', romanization: undefined, pronunciation: undefined }] })
  expect(result.receipt).toMatchObject({ providerExecution: false, consultedSources: [{ sourceId: 'source-beach', anchors: [{ start: 3, end: 8 }] }, { sourceId: 'source-shore' }] })
  expect(JSON.stringify(result.receipt)).not.toContain('La playa.')
})

it('preserves exact encodings and offsets across scripts without normalizing the source', () => {
  for (const text of ['\u0643\u062a\u0627\u0628', '\u4e66', 'e\u0301', '\u00e9']) {
    const result = savedReadingResult(text, [source(text, 'meaning')])!
    expect(result.gloss).toMatchObject({ coverage: 'complete', segments: [{ start: 0, end: text.length, gloss: 'meaning' }] })
    expect(savedGlossQuery({ ...scope, text, aid: 'word_gloss' } as ReadingInput).surfaces[0]).toBe(text)
  }
  expect(savedReadingResult('e\u0301', [source('\u00e9', 'meaning')])).toBeNull()
  expect(savedReadingResult('Playa', [source('playa', 'beach')])).toBeNull()
})

it('does not let substring candidates masquerade as an exact word or cross language scope', () => {
  expect(savedReadingResult('play', [source('playa', 'beach')])).toBeNull()
  const different = { ...source('playa', 'plage'), scope: { ...scope, explanation: 'french' } }
  expect(savedReadingResult('playa', [source('playa', 'beach'), different])?.gloss?.segments[0].gloss).toBe('beach')
})
