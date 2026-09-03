import type { Scaffolds, StoredTurn } from '../types'

/// One message as the backend wants it.
export interface ChatMessage {
  role: string
  content: string
}

/// The conversation flattened into alternating messages, oldest first, capped
/// to the most recent `limit`.
///
/// Only settled turns are included: one still streaming has no reply yet, and
/// sending a half-formed exchange as history would have the tutor answer
/// something it never said.
export function chatHistory(turns: StoredTurn[], limit: number): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const turn of turns) {
    if (!turn.assistant) continue
    if (turn.user) messages.push({ role: 'user', content: turn.user })
    messages.push({ role: 'assistant', content: turn.assistant.reply })
  }
  return messages.slice(-limit)
}

/// The most recent turn that has a reply, or null.
///
/// A plain backward scan rather than `[...turns].reverse().find(...)`: that
/// copies the whole conversation, and it ran three times per render.
export function latestAnswered(turns: StoredTurn[]): StoredTurn | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].assistant) return turns[i]
  }
  return null
}

function hasAny(s: Scaffolds): boolean {
  return s.replies.length > 0 || s.frames.length > 0 || s.starters.length > 0
}

/// The newest suggestions any turn produced.
///
/// Best-available rather than newest-turn: an analysis pass can degrade and
/// leave a turn with empty lists, and showing nothing when an earlier turn
/// still has usable chips would be worse than showing the older ones.
export function latestScaffolds(turns: StoredTurn[]): Scaffolds | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const s = turns[i].assistant?.scaffolds
    if (s && hasAny(s)) return s
  }
  return null
}

/// The recent exchange as plain text, for the coach thread's context.
export function transcriptForCoach(turns: StoredTurn[], limit: number): string {
  return turns
    .slice(-limit)
    .flatMap((t) =>
      [
        t.user ? `LEARNER: ${t.user}` : null,
        t.assistant ? `NATIVE: ${t.assistant.reply}` : null,
      ].filter((line): line is string => line !== null)
    )
    .join('\n')
}
