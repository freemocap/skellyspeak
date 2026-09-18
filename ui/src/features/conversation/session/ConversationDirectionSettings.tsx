import { useState } from 'react'
import type { ConversationDirection, Snapshot, TopicCard } from '../../../generated/contracts'
import { useI18n } from '../../../components/localization/i18n'
import { executeAction, nativeError, readWorkspace } from '../../../platform/ipc/workspace'
import { ConversationPromptCreator } from './ConversationPromptCreator'

/** Reopens the same creator for subsequent turns; native applies settings and saved topics together. */
export function ConversationDirectionSettings({ conversationId, topics, direction }: { conversationId: string; topics: TopicCard[]; direction: ConversationDirection }) {
  const tr = useI18n()
  const [workspace, setWorkspace] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const owner = workspace?.conversations.find(item => item.id === conversationId)
  const contact = workspace?.contacts.find(item => item.id === owner?.contactId)
  const persona = workspace?.personas.find(item => item.id === contact?.personaId)
  const language = workspace?.languages.find(item => item.id === owner?.languageId)
  const topic = direction.topic?.kind === 'custom' ? direction.topic.text : direction.topic?.kind === 'builtin' ? topics.find(item => direction.topic?.kind === 'builtin' && item.id === direction.topic.id)?.label : tr('Partner chooses')
  return <section className="conversation-settings-group">
    <p className="prompt-topic-summary">{topic} · {tr({ any: 'No preference', past: 'Past events', future: 'Future plans' }[direction.timeReference])}</p>
    <button type="button" className="btn" onClick={async () => { setError(null); try { setWorkspace(await readWorkspace()) } catch (reason) { setError(nativeError(reason)) } }}>{tr('Conversation Prompt Creator')}</button>
    {error && <p role="alert">{error}</p>}
    {workspace && owner && persona && language && <ConversationPromptCreator conversationId={conversationId} initial={{ difficulty: owner.settings.difficulty, varietyId: owner.settings.varietyId, direction: owner.settings.direction }} topics={topics} savedTopics={workspace.savedTopics} language={language} persona={persona.details} onClose={() => setWorkspace(null)} onApply={async (configuration, additions, deletions) => {
      await executeAction(workspace, { kind: 'updateConversationPrompt', conversationId, configuration, additions, deletions, expectedRevision: workspace.revision, expectedSettingsRevision: owner.settingsRevision })
    }} />}
  </section>
}
