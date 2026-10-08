import type { SavedGlossSource, SavedGlossQuery, ReadingInput } from '../../generated/contracts'
import { savedGlossIndex } from './saved-gloss-index'
import { readingWords } from './word-boundaries'
import type { ReadingHelpResult } from './reading-result'

export function savedGlossQuery(input: ReadingInput): SavedGlossQuery {
  const { language, variety, explanation, explanationVariety, text } = input
  return { scope: { language, variety, explanation, explanationVariety },
    surfaces: [...new Set([text, ...readingWords(text).filter(word => word.word).map(word => text.slice(word.start, word.end))])] }
}

export function savedReadingResult(text: string, sources: SavedGlossSource[]): ReadingHelpResult | null {
  if (!sources.length) return null
  // Native lookup resolves omitted varieties and filters by the captured scope.
  const scope = sources[0].scope
  const segments = savedGlossIndex(sources)(text, scope)
  if (!segments.length) return null
  const dictionaryAnchors = segments.filter(part => part.dictionary).map(({ start, end }) => ({ start, end }))
  const complete = !dictionaryAnchors.length && readingWords(text).filter(word => word.word).every(word => {
    let end = word.start
    for (const part of segments) if (part.start <= end && part.end > end) end = part.end
    return end >= word.end
  })
  return { ...(dictionaryAnchors.length ? { dictionaryAnchors } : {}), gloss: { segments, coverage: complete ? 'complete' : 'partial' },
    audioBase64: null, audioAlignment: null, translation: null, explanations: null,
    receipt: { kind: 'saved_gloss_lookup', providerExecution: false,
      // These are consulted records, including alternate meanings; no source content is copied into diagnostics.
      consultedSources: sources.filter(source => savedGlossIndex([source])(text, scope).length).map(source => ({
        sourceId: source.sourceId, dictionary: source.dictionary ?? false, provenance: source.provenance ? { packageId: source.provenance.packageId, version: source.provenance.version, review: source.provenance.review } : null, operationId: source.operationId, attemptId: source.attemptId,
        anchors: source.segments.map(({ start, end }) => ({ start, end })),
      })) } }
}
