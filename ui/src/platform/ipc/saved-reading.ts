import type { ReadingInput, SavedGlossSource } from '../../generated/contracts'
import { savedGlossQuery, savedReadingResult } from '../../domain/reading/saved-reading-result'
import { invoke } from './native'

/** Read accepted data on demand. No network, result cache or mounted view participates. */
export async function readSavedGloss(input: ReadingInput, signal: AbortSignal) {
  signal.throwIfAborted()
  if (input.aid !== 'word_gloss') return null
  const sources = await invoke<SavedGlossSource[]>('get_saved_gloss_sources', { query: savedGlossQuery(input) })
  signal.throwIfAborted()
  return savedReadingResult(input.text, sources)
}
