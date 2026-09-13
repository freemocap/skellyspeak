import { invoke } from './native'
import type { Action, Command, Conversation, ConversationSnapshot, PersonaDetails, PersonaGenerationActivity, Receipt, Snapshot } from '../../contracts'

export function readWorkspace(): Promise<Snapshot> {
  return invoke<Snapshot>('get_snapshot')
}

/** Commands carry the native session and a unique delivery identity; never retry automatically. */
export function executeAction(snapshot: Pick<Snapshot, 'sessionId'>, action: Action): Promise<Receipt> {
  const command: Command = { sessionId: snapshot.sessionId, actionId: crypto.randomUUID(), action }
  return invoke<Receipt>('execute_command', { command })
}

/** Reserve an owned generation before any provider work starts. */
export function beginPersonaGeneration(languageId: string, brief: string): Promise<string> {
  const trimmed = brief.trim()
  return invoke<string>('begin_persona_generation', { languageId, brief: trimmed ? trimmed : null })
}

/** Fill a proposal for review; creating the contact remains an explicit action. */
export function runPersonaGeneration(generationId: string): Promise<PersonaDetails> {
  return invoke<PersonaDetails>('run_persona_generation', { generationId })
}

export function cancelPersonaGeneration(generationId: string): Promise<void> {
  return invoke<void>('cancel_persona_generation', { generationId })
}

/** Global retained generation metadata only; inspecting never generates a persona. */
export function readPersonaGenerationActivity(): Promise<PersonaGenerationActivity> {
  return invoke<PersonaGenerationActivity>('get_persona_generation_activity')
}

/** The one creation action: a persona, its contact, and their first conversation.
 * Returns the conversation to open. */
export async function createContact(languageId: string, details: PersonaDetails): Promise<string> {
  const snapshot = await readWorkspace()
  const receipt = await executeAction(snapshot, { kind: 'createContact', languageId, details })
  return receipt.entityId
}

export function watchConversation(conversationId: string, afterRevision = -1, before: number | null = null): Promise<ConversationSnapshot> {
  return invoke<ConversationSnapshot>('watch_conversation', { conversationId, afterRevision, before })
}

export function selectedConversation(snapshot: Snapshot, languageId?: string): Conversation | null {
  return snapshot.conversations.filter(c => !c.archived && (!languageId || c.languageId === languageId))
    .sort((a, b) => b.lastUsed - a.lastUsed || a.id.localeCompare(b.id))[0] ?? null
}

export function nativeError(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return String(error)
}
