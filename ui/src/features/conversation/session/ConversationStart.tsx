import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { TargetText } from '../../../components/reading/TargetText'
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
/// **Let {name} start** and topic buttons start a partner-first exchange with
/// no learner message. A custom topic starts when its dialog is confirmed. This component owns display and callbacks only; recording,
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
  onChange: (value: ConversationStartConfig) => void; onStart: (configuration: ConversationStartConfig) => Promise<void>
}) {
  const tr = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<Snapshot | null>(null)
  const [custom, setCustom] = useState(false)
  async function start(configuration = value) {
    if (busy || pending.current || !canPartnerStart || recording || transcribing) return
    pending.current = true; setSubmitting(true); setError(null)
    try { await onStart(configuration) } catch (reason) { setError(nativeError(reason)) }
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
      <div className="invitation-header">
        <div className="invitation-partner">
          <PersonaAvatar symbol={partnerSymbol} />
          {partnerName && <h2><bdi lang={targetTag} dir={targetDir}><TargetText text={partnerName} /></bdi></h2>}
        </div>
        {(onSwitchPartner || onEditPersona) && <div className="invitation-partner-actions">
          {onSwitchPartner && <button type="button" className="btn" disabled={disabled} onClick={onSwitchPartner}>{tr('All partners')}</button>}
          {onEditPersona && <button type="button" className="btn" disabled={disabled} onClick={onEditPersona}>{tr('Edit persona')}</button>}
        </div>}
      </div>
      <div className="prompt-actions">
        <button type="button" className="start-conversation-button" disabled={disabled || !canPartnerStart} onClick={() => void start()}>{submitting ? tr('Starting…') : tr('Let {name} start', { name })}</button>
        <button type="button" className="start-greeting-button" disabled={busy || submitting || transcribing} onClick={onRecord}>
          <span className="start-greeting-dot" aria-hidden="true" />
          {recording ? tr('Stop') : tr('Say {greeting}', { greeting: greeting.text })}
        </button>
      </div>
      {error && <ErrorNotice as="p" error={error} className="start-error">{error}</ErrorNotice>}
    </div>
    <ConversationChoices value={value} topics={topics} disabled={disabled} targetTag={targetTag} targetDir={targetDir} onChange={onChange} topicsDisabled={disabled || !canPartnerStart} onChooseTopic={configuration => { onChange(configuration); void start(configuration) }} onCustom={() => setCustom(true)} />
    <div className="prompt-actions">
      <button type="button" className="btn" disabled={disabled} onClick={async () => { setError(null); try { setWorkspace(await readWorkspace()) } catch (reason) { setError(nativeError(reason)) } }}>{tr('Customize…')}</button>
    </div>
    {value.direction.topic?.kind === 'custom' && <p className="prompt-topic-summary"><TargetText text={value.direction.topic.text} /></p>}
    {workspace && persona && language && <ConversationPromptCreator conversationId={conversationId} initial={value} topics={topics} savedTopics={workspace.savedTopics} language={language} persona={persona.details} onClose={() => setWorkspace(null)} onApply={async (configuration, additions, deletions) => { await saveTopics(additions, deletions); onChange(configuration) }} />}
    {custom && <CustomTopicDialog initial={value.direction.topic?.kind === 'custom' ? value.direction.topic.text : ''} onClose={() => setCustom(false)} onUse={async (text, save) => { if (save) await saveTopics([text], []); const configuration: ConversationStartConfig = { ...value, direction: { ...value.direction, topic: { kind: 'custom', text } } }; onChange(configuration); await start(configuration) }} />}
  </section>
}
