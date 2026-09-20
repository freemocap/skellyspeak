import { PersonaAvatar } from '../../../components/media/PersonaAvatar'
import { useI18n } from '../../../components/localization/i18n'
import type { ConversationStartConfig, Snapshot, StarterGreeting, TopicCard } from '../../../generated/contracts'
import { useRef, useState } from 'react'
import { executeAction, nativeError, readWorkspace } from '../../../platform/ipc/workspace'
import { ConversationChoices } from './ConversationChoices'
import { ConversationPromptCreator } from './ConversationPromptCreator'
import { CustomTopicDialog } from './CustomTopicDialog'

/// The empty conversation: who the learner is about to talk to, the two ways to
/// begin, and the optional choices that shape the opening.
///
/// It renders inside the ordinary message stream, above the ordinary composer.
/// Two things begin a conversation and they are kept distinct: **Say {greeting}**
/// opens the microphone and nothing more — the conversation is admitted when the
/// learner sends the transcript, exactly as typing and sending would — while
/// **Let {name} start** is the separate partner-first action that sends no
/// learner message. This component owns display and callbacks only; recording,
/// the draft and submission stay with the page, and capture stays with the
/// recorder the composer already uses.
export function ConversationStart({ topics, busy, onStart, partnerName, partnerSymbol, conversationId, value, onChange, greeting, targetTag, targetDir, recording, transcribing, canPartnerStart, onRecord, onEditPersona, onSwitchPartner }: {
  partnerName?: string; partnerSymbol?: string; conversationId: string
  topics: TopicCard[]; busy: boolean; value: ConversationStartConfig
  /// Authored display content for the conversation's target language.
  greeting: StarterGreeting
  targetTag?: string; targetDir?: string
  recording: boolean; transcribing: boolean
  /// False while the composer holds a draft or the microphone is in use: a
  /// partner-first opening would either talk over an unsent first message or
  /// land in the middle of one recording.
  canPartnerStart: boolean
  onRecord: () => void
  onEditPersona?: () => void
  onSwitchPartner?: () => void
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
  // One guard for every control that begins or captures: the configuration must
  // not move under a recording that has already started.
  const disabled = busy || submitting || recording || transcribing
  const name = partnerName ?? tr('partner')
  const owner = workspace?.conversations.find(item => item.id === conversationId)
  const contact = workspace?.contacts.find(item => item.id === owner?.contactId)
  const persona = workspace?.personas.find(item => item.id === contact?.personaId)
  const language = workspace?.languages.find(item => item.id === owner?.languageId)
  return <section className="conversation-start" aria-label={tr('Start a conversation')} aria-busy={submitting}>
    <div className="invitation">
      {/* The partner is the most prominent thing here, so changing or editing
          them belongs beside them as well as in the chat header. */}
      {(onSwitchPartner || onEditPersona) && <div className="invitation-partner-actions">
        {onSwitchPartner && <button type="button" className="btn tiny" disabled={disabled} onClick={onSwitchPartner}>{tr('All partners')}</button>}
        {onEditPersona && <button type="button" className="btn tiny" disabled={disabled} onClick={onEditPersona}>{tr('Edit persona')}</button>}
      </div>}
      <PersonaAvatar symbol={partnerSymbol} />
      {partnerName && <h2><bdi lang={targetTag} dir={targetDir}>{partnerName}</bdi></h2>}
      <div className="prompt-actions">
        <button type="button" className="start-conversation-button" disabled={disabled || !canPartnerStart} onClick={() => void start()}>{submitting ? tr('Starting…') : tr('Let {name} start', { name })}</button>
        <button type="button" className="start-greeting-button" disabled={busy || submitting || transcribing} onClick={onRecord}>
          <span className="start-greeting-dot" aria-hidden="true" />
          {recording ? tr('Stop') : tr('Say {greeting}', { greeting: greeting.text })}
        </button>
      </div>
      {greeting.romanized && <p className="start-greeting-romanized" dir="ltr">{greeting.romanized}</p>}
      <span className="start-hint">{tr('or send a message below')}</span>
    </div>
    <ConversationChoices value={value} topics={topics} disabled={disabled} targetTag={targetTag} targetDir={targetDir} onChange={onChange} onCustom={() => setCustom(true)} />
    <div className="prompt-actions">
      <button type="button" className="btn" disabled={disabled} onClick={async () => { setError(null); try { setWorkspace(await readWorkspace()) } catch (reason) { setError(nativeError(reason)) } }}>{tr('Customize…')}</button>
    </div>
    {value.direction.topic?.kind === 'custom' && <p className="prompt-topic-summary">{value.direction.topic.text}</p>}
    {error && <p role="alert">{error}</p>}
    {workspace && persona && language && <ConversationPromptCreator conversationId={conversationId} initial={value} topics={topics} savedTopics={workspace.savedTopics} language={language} persona={persona.details} onClose={() => setWorkspace(null)} onApply={async (configuration, additions, deletions) => { await saveTopics(additions, deletions); onChange(configuration) }} />}
    {custom && <CustomTopicDialog initial={value.direction.topic?.kind === 'custom' ? value.direction.topic.text : ''} onClose={() => setCustom(false)} onUse={async (text, save) => { if (save) await saveTopics([text], []); onChange({ ...value, direction: { ...value.direction, topic: { kind: 'custom', text } } }) }} />}
  </section>
}
