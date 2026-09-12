import { invoke } from './native'
import type { Action, Command, Conversation, ConversationSnapshot, PersonaDetails, Receipt, Snapshot } from '../../contracts'

export function readWorkspace(): Promise<Snapshot> {
  return invoke<Snapshot>('get_snapshot')
}

/** Commands carry the native session and a unique delivery identity; never retry automatically. */
export function executeAction(snapshot: Pick<Snapshot, 'sessionId'>, action: Action): Promise<Receipt> {
  const command: Command = { sessionId: snapshot.sessionId, actionId: crypto.randomUUID(), action }
  return invoke<Receipt>('execute_command', { command })
}

/** One structured model call that proposes a persona. Nothing is saved: the
 * learner reviews the proposal and creates the contact explicitly. */
export function generatePersona(languageId: string, brief: string): Promise<PersonaDetails> {
  const trimmed = brief.trim()
  return invoke<PersonaDetails>('generate_persona', { languageId, brief: trimmed ? trimmed : null })
}

/** The one creation action: a persona, its contact, and their first conversation.
 * Returns the conversation to open. */
export async function createContact(languageId: string, details: PersonaDetails): Promise<string> {
  const snapshot = await readWorkspace()
  const receipt = await executeAction(snapshot, { kind: 'createContact', languageId, details })
  return receipt.entityId
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
