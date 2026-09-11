import type { ReactNode } from 'react'
import type { Difficulty } from '../../contracts'
import { ErrorDetails } from '../ErrorDetails'
import { DifficultySelect } from './DifficultySelect'

export function ConversationHeader({ languages, difficulty, saving, error, onDifficulty, children }: {
  languages: ReactNode; difficulty?: Difficulty; saving: boolean; error: string | null
  onDifficulty: (value: Difficulty) => Promise<void>; children: ReactNode
}) {
  return <div className="chat-head">
    <div className="conversation-title" aria-label="Current conversation settings">
      <div className="conversation-languages">{languages}{difficulty && <DifficultySelect value={difficulty} saving={saving} onChange={onDifficulty} />}</div>
      {error && <ErrorDetails label="Conversation settings" errorKey={error}>{error}</ErrorDetails>}
    </div>
    {children}
  </div>
}
