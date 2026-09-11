import type { ReactNode } from 'react'
import type { Difficulty } from '../../contracts'
import { ErrorDetails } from '../ErrorDetails'
import { DIFFICULTIES, DifficultySelect } from './DifficultySelect'

export function ConversationHeader({ languages, summary, onOpenSettings, difficulty, saving, error, onDifficulty, children }: {
  languages: ReactNode; summary?: ReactNode; onOpenSettings?: () => void; difficulty?: Difficulty; saving: boolean; error: string | null
  onDifficulty: (value: Difficulty) => Promise<void>; children: ReactNode
}) {
  return <div className="chat-head">
    <div className="conversation-title" aria-label="Current conversation settings">
      {summary && <button type="button" className="conversation-summary" onClick={onOpenSettings} aria-label="Open conversation settings" title="Open language, difficulty and voice settings">{summary} · <strong>Difficulty:</strong> {DIFFICULTIES.find(item => item.value === difficulty)?.label}</button>}
      {!summary && <div className="conversation-languages">{languages}{difficulty && <DifficultySelect value={difficulty} saving={saving} onChange={onDifficulty} />}</div>}
      {error && <ErrorDetails label="Conversation settings" errorKey={error}>{error}</ErrorDetails>}
    </div>
    {children}
  </div>
}
