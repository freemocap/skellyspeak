import type { ReactNode } from 'react'
import type { Difficulty } from '../../contracts'
import { ErrorDetails } from '../../ui/ErrorDetails'
import { DifficultySelect } from './DifficultySelect'

/// "Learning: <language>", the persona this conversation speaks through, and this
/// conversation's difficulty.
export function ConversationHeader({ learning, persona, difficulty, saving, error, onDifficulty, children }: {
  learning: ReactNode; persona?: ReactNode; difficulty?: Difficulty; saving: boolean; error: string | null
  onDifficulty: (value: Difficulty) => Promise<void>; children: ReactNode
}) {
  return <div className="chat-head">
    <div className="conversation-title" aria-label="Current conversation settings">
      <div className="learning-line">
        <span className="learning-label">Learning:</span>
        {learning}
        {difficulty && <DifficultySelect value={difficulty} saving={saving} onChange={onDifficulty} />}
        {persona}
      </div>
      {error && <ErrorDetails label="Conversation settings" errorKey={error}>{error}</ErrorDetails>}
    </div>
    {children}
  </div>
}
