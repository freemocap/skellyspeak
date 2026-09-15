import { invoke } from './native'
export interface ConversationExportOptions { conversationId: string; includeCoach: boolean; includeBackend: boolean }
export const conversationYaml = (options: ConversationExportOptions): Promise<string> => invoke('view_conversation_yaml', { ...options })
export const saveConversationYaml = (options: ConversationExportOptions): Promise<string> => invoke('save_conversation_yaml', { ...options })
