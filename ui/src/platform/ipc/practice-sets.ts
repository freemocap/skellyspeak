import type { PracticeSet, DrillGenerationPreview, DrillItemView, PracticeSetSummary, ReadingScope } from '../../generated/contracts'
import { invoke } from './native'

export function getPracticeSets(language: string, variety: string | null): Promise<PracticeSetSummary[]> {
  return invoke('get_practice_sets', { language, variety })
}

export function previewPracticeSet(scope: ReadingScope, set: PracticeSet): Promise<DrillGenerationPreview> {
  return invoke('preview_practice_set', { scope, set })
}

export function acceptPracticePhrases(scope: ReadingScope, set: PracticeSet, requestId: string, candidateIds: string[]): Promise<DrillItemView[]> {
  return invoke('accept_practice_phrases', { scope, set, requestId, candidateIds })
}
