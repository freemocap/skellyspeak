import { invoke } from './native'
import type { MessageHistory } from '../../generated/contracts'

/** Complete fix history for a learner message, independent of loaded chat pages. */
export function readMessageHistory(conversationId: string, messageId: string): Promise<MessageHistory> {
  return invoke<MessageHistory>('get_message_history', { conversationId, messageId })
}
