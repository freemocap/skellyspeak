import { useI18n } from '../../ui/i18n'
import type { ReactNode } from 'react'
import type { Difficulty } from '../../contracts'
import { ErrorDetails } from '../../ui/ErrorDetails'
import { DifficultySelect } from './DifficultySelect'

/// The target language, the persona this conversation speaks through, and this
/// conversation's difficulty.
export function ConversationHeader({ learning, persona, difficulty, saving, error, onDifficulty, children }: {
  learning: ReactNode; persona?: ReactNode; difficulty?: Difficulty; saving: boolean; error: string | null
  onDifficulty: (value: Difficulty) => Promise<void>; children: ReactNode
}) {
  const tr = useI18n()
  return <div className="chat-head">
    <div className="conversation-title" aria-label={tr("Current conversation settings")}>
      <div className="learning-line">
        {learning}
        {difficulty && <DifficultySelect value={difficulty} saving={saving} onChange={onDifficulty} />}
        {persona}
      </div>
      {error && <ErrorDetails label={tr("Conversation settings")} errorKey={error}>{error}</ErrorDetails>}
    </div>
    {children}
  </div>
}
