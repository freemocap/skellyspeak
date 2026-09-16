import type { LanguageInspection } from '../../generated/contracts'
import { invoke } from './native'

export function inspectLanguage(language: string, variety: string, explanation: string, explanationVariety: string): Promise<LanguageInspection> {
  return invoke<LanguageInspection>('inspect_language', { language, variety, explanation, explanationVariety })
}
