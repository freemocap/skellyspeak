import type { ReadingResult, WordGlossView } from '../../generated/contracts'

/** Display data can be a projection of several accepted annotations, not a new inference. */
export type ReadingHelpResult = Omit<ReadingResult, 'gloss'> & {
  gloss: Pick<WordGlossView, 'segments' | 'coverage'> | null
}

export interface ReadingLookupOptions {
  retry?: boolean
  selection?: { start: number; end: number }
}
