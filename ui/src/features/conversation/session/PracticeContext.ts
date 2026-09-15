import { createContext } from 'react'

/// The skill the learner has selected for the conversation on screen, shared by
/// the chat bubbles, the learning panel and the profile overlay.
export const PracticeContext = createContext<{
  chatId: string | null
  selectionVersion: number
  selected: string | null
  select: (id: string) => void
} | null>(null)
