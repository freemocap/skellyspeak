import { ReadingScopeContext } from '../../../components/reading/ReadingContext'
import { useContext, useMemo, type ReactNode } from 'react'
import type { Conversation, ConversationSnapshot } from '../../../generated/contracts'
import { SavedReadingProvider } from '../../../components/reading/SavedReadingProvider'
import type { SavedGlossSource } from '../../../domain/reading/saved-gloss-index'

/** Project the already-loaded durable conversation annotations for every surface. */
export function ConversationReadingProvider({ snapshot, conversation, children }: { snapshot: ConversationSnapshot | null; conversation: Conversation | null | undefined; children: ReactNode }) {
  const inheritedScope = useContext(ReadingScopeContext)
  const sources = useMemo<SavedGlossSource[]>(() => {
    if (!snapshot || !conversation || snapshot.conversationId !== conversation.id) return []
    const scope = { language: conversation.languageId, variety: conversation.settings.varietyId, explanation: conversation.settings.explanationLanguage, explanationVariety: conversation.settings.explanationVarietyId }
    return [...snapshot.messages, ...snapshot.coachMessages].filter(message => !message.replacedBy).flatMap(message => [
      ...(message.wordGloss ? [{ text: message.text, segments: message.wordGloss.segments, scope: { ...scope, language: message.wordGloss.targetLanguageId, explanation: message.wordGloss.explanationLanguageId } }] : []),
      ...(message.suggestedReplies ?? []).map(reply => ({ text: reply.text, segments: reply.segments, scope })),
    ])
  }, [snapshot, conversation])
  const scope = conversation ? { language: conversation.languageId, variety: conversation.settings.varietyId, explanation: conversation.settings.explanationLanguage, explanationVariety: conversation.settings.explanationVarietyId } : inheritedScope
  return <SavedReadingProvider sources={sources}><ReadingScopeContext value={scope}>{children}</ReadingScopeContext></SavedReadingProvider>
}
