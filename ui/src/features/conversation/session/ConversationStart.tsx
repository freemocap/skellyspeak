import { PersonaAvatar } from '../../../components/media/PersonaAvatar'
import { useI18n } from '../../../components/localization/i18n'
import type { ConversationStartConfig, Snapshot, TopicCard } from '../../../generated/contracts'
import { useRef, useState } from 'react'
import { executeAction, nativeError, readWorkspace } from '../../../platform/ipc/workspace'
import { ConversationChoices } from './ConversationChoices'
import { ConversationPromptCreator } from './ConversationPromptCreator'
import { CustomTopicDialog } from './CustomTopicDialog'

export function ConversationStart({ topics, busy, onStart, partnerName, partnerSymbol, conversationId, value, onChange }: {
  partnerName?: string; partnerSymbol?: string; conversationId: string
  topics: TopicCard[]; busy: boolean; value: ConversationStartConfig
  onChange: (value: ConversationStartConfig) => void; onStart: () => Promise<void>
}) {
  const tr = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<Snapshot | null>(null)
  const [custom, setCustom] = useState(false)
  async function start() {
    if (busy || pending.current) return
    pending.current = true; setSubmitting(true); setError(null)
    try { await onStart() } catch (reason) { setError(nativeError(reason)) }
    finally { pending.current = false; setSubmitting(false) }
  }
  async function saveTopics(additions: string[], deletions: string[]) {
    if (!additions.length && !deletions.length) return
    const current = workspace ?? await readWorkspace()
    await executeAction(current, { kind: 'saveTopics', additions, deletions, expectedRevision: current.revision })
  }
  const disabled = busy || submitting
  const owner = workspace?.conversations.find(item => item.id === conversationId)
  const contact = workspace?.contacts.find(item => item.id === owner?.contactId)
  const persona = workspace?.personas.find(item => item.id === contact?.personaId)
  const language = workspace?.languages.find(item => item.id === owner?.languageId)
  return <section className="conversation-start" aria-label={tr('Start a conversation')} aria-busy={submitting}>
    <PersonaAvatar symbol={partnerSymbol} />
    {partnerName && <h2>{partnerName}</h2>}
    <ConversationChoices value={value} topics={topics.slice(0, 3)} disabled={disabled} onChange={onChange} onCustom={() => setCustom(true)} />
    <div className="prompt-actions"><button type="button" className="start-conversation-button" disabled={disabled} onClick={() => void start()}>{submitting ? tr('Starting…') : tr('Let {name} start', { name: partnerName ?? tr('partner') })}</button>
      <button type="button" className="btn" disabled={disabled} onClick={async () => { setError(null); try { setWorkspace(await readWorkspace()) } catch (reason) { setError(nativeError(reason)) } }}>{tr('Customize…')}</button></div>
    {value.direction.topic?.kind === 'custom' && <p className="prompt-topic-summary">{value.direction.topic.text}</p>}
    <span className="start-hint">{tr('or send a message below')}</span>
    {error && <p role="alert">{error}</p>}
    {workspace && persona && language && <ConversationPromptCreator conversationId={conversationId} initial={value} topics={topics} savedTopics={workspace.savedTopics} language={language} persona={persona.details} onClose={() => setWorkspace(null)} onApply={async (configuration, additions, deletions) => { await saveTopics(additions, deletions); onChange(configuration) }} />}
    {custom && <CustomTopicDialog initial={value.direction.topic?.kind === 'custom' ? value.direction.topic.text : ''} onClose={() => setCustom(false)} onUse={async (text, save) => { if (save) await saveTopics([text], []); onChange({ ...value, direction: { ...value.direction, topic: { kind: 'custom', text } } }) }} />}
  </section>
}
