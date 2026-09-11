import { invoke } from '@tauri-apps/api/core'
import type { Action, Command, Conversation, ConversationSnapshot, Receipt, Snapshot } from '../contracts'

export function readWorkspace(): Promise<Snapshot> {
  return invoke<Snapshot>('get_snapshot')
}

/** Commands carry the native session and a unique delivery identity; never retry automatically. */
export function executeAction(snapshot: Pick<Snapshot, 'sessionId'>, action: Action): Promise<Receipt> {
  const command: Command = { sessionId: snapshot.sessionId, actionId: crypto.randomUUID(), action }
  return invoke<Receipt>('execute_command', { command })
}

export function watchConversation(conversationId: string, afterRevision = -1): Promise<ConversationSnapshot> {
  return invoke<ConversationSnapshot>('watch_conversation', { conversationId, afterRevision, before: null })
}

export function selectedConversation(snapshot: Snapshot, languageId?: string): Conversation | null {
  return snapshot.conversations.filter(c => !c.archived && (!languageId || c.languageId === languageId))
    .sort((a, b) => b.lastUsed - a.lastUsed || a.id.localeCompare(b.id))[0] ?? null
}

export function nativeError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return String(error)
}
