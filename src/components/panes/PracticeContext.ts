import { createContext } from 'react'
import type { Scaffolds } from '../../types'

export const PracticeContext = createContext<{
  chatId: string | null
  selectionVersion: number
  selected: string | null
  select: (id: string) => void
} | null>(null)

export const DraftAssistanceContext = createContext<{
  useExample: (text: string, source: 'suggestion' | 'scaffold') => void
  suggestions: Scaffolds
  suggestionsError: string | null
} | null>(null)
