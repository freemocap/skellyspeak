import { PersonaProfileDialog } from './PersonaProfileDialog'
import { ConversationHeader } from './ConversationHeader'
import { PersonaProfile } from './PersonaProfile'
import { NewPersonaDialog } from './NewPersonaDialog'
import { PersonaPicker } from './PersonaPicker'
import { useConversationDetails } from './useConversationDetails'
import { ComposerInput } from './ComposerInput'
import { ErrorDetails } from '../../ui/ErrorDetails'
import { ReadingPreferencesProvider } from '../../ui/ReadingPreferences'
import { configureRewardSounds, stopRewardSounds } from '../../platform/audio/reward-sounds'
import { RewardPresentationProvider } from './RewardPresentation'
import { ActivityIndicator } from '../../ui/ActivityIndicator'
import { ComposerHelp } from './ComposerHelp'
import { useSkillNavigationStore } from '../../state/skill-navigation'
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createContact as createContactRequest, executeAction, readWorkspace, nativeError } from '../../platform/ipc/workspace'
import type { Settings } from '../../types'
import type { PersonaDetails } from '../../contracts'
import { unreportedInput, type InputEvidence } from '../../domain/skills/skills'
import { PracticeContext } from './PracticeContext'
import { SkillRewards } from './SkillRewards'
import { GlossPopup } from './GlossPopup'
import { isTauri, languageFor } from '../../platform/ipc/tauri'
import { languageLabel } from '../../domain/language/language-label'
import { personaName } from './personaLimits'
import { useSettingsStore } from '../../state/settings'
import { useSessionStore } from '../../state/session'
// Where the narrow-window layout puts the learner: the shell's navigation state
// decides it, so the type lives with that state.
import type { MobileLocation } from '../../state/navigation'
import { useMessageSpeech } from './useMessageSpeech'
import { comboFromEvent } from '../../domain/input/keyboard'
import { WaveformStrip } from '../../ui/WaveformStrip'
import { EditFeedback } from './EditFeedback'
import { TurnView } from './TurnView'
import { DetailDialog } from '../../ui/DetailDialog'
import { AnalysisContent } from './AnalysisContent'
import { CoachAnalysisPanel } from './CoachAnalysisPanel'
import { logInfo, logWarn } from '../../platform/diagnostics/log'
import { ChatHistory } from './ChatHistory'
import { latestAnswered } from '../../domain/language/turns'
import { useConversation } from './useConversation'
import { useWordInspection } from './useWordInspection'
import { useMicRecorder } from './useMicRecorder'
import { usePersistentToggle } from '../../ui/usePersistentToggle'
import { useIsMobile } from '../../ui/useIsMobile'
import { reportFault } from '../../platform/diagnostics/faults'
import { needsProviderSetup } from '../../domain/access/providers'

/// Number of conversation stripe hues: the .chat[data-stripe] rules in
/// conversation.css and the --chat-stripe-* tokens in tokens.css.
const CHAT_STRIPES = 5

export default function GuidedPage({
  active,
  learningPicker,
  nativePicker,
  mobileSurface,
  historyOpen = false,
  onHistoryOpenChange,
  onOpenSettings,
  onNewChatReady,
}: {
  active: boolean
  /// The target-language picker shown large in the conversation header.
  learningPicker: ReactNode
  /// The explanation-language picker, kept in the conversation settings panel.
  nativePicker: ReactNode
  mobileSurface: MobileLocation
  historyOpen?: boolean
  onHistoryOpenChange?: (open: boolean) => void
  /// Open the Settings modal. It lands on the AI provider section, which is
  /// where every "configure a provider" failure is asking the learner to go.
  onNewChatReady?: (action: (() => void) | null) => void
  onOpenSettings?: () => void
}) {
  const workspace = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLDivElement>(null)
  const stopSpeechRef = useRef<() => void>(() => {})
  const selectionVersion = useSkillNavigationStore((state) => state.sequence)
  const skillSelection = useSkillNavigationStore((state) => state.selected)
  const selectSkill = useSkillNavigationStore((state) => state.select)
  const [pinnedId, setPinnedId] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef(error)
  errorRef.current = error
  const [input, setInputState] = useState('')
  const inputRevision = useRef(0)
  const setInput = useCallback((value: string | ((previous: string) => string)) => { inputRevision.current += 1; setInputState(value) }, [])
  const inputEvidence = useRef<InputEvidence>(unreportedInput())
  // Set while the learner is retrying a past message: the composer is
  // pre-filled with what they said, and sending it discards that turn and
  // everything after it, then regenerates from the edited text.
  const [editingTurnId, setEditingTurnId] = useState<number | null>(null)
  const connection = useSessionStore((state) => state.connection)
  const signingIn = useSessionStore((state) => state.signingIn)
  const startHostedSignIn = useSessionStore((state) => state.startHostedSignIn)
  const settings = useSettingsStore((state) => state.settings)
  // Bumped when a settings **write** lands. Switching conversations reloads the
  // record without bumping it: a different scope is not a settings change.
  const settingsVersion = useSettingsStore((state) => state.revision)
  useEffect(() => {
    if (settings) configureRewardSounds(settings.reward_sounds, settings.auto_speak)
    if (!active) stopRewardSounds()
  }, [settings?.reward_sounds, settings?.auto_speak, active])
  useEffect(() => () => stopRewardSounds(), [])
  const [panelTab, setPanelTab] = useState<'lesson' | 'profile'>('lesson')
  const [coachDraft, setCoachDraft] = useState('')
  const [reviewing, setReviewing] = useState<Set<number>>(new Set())
  const consumeCoachDraft = useCallback(() => setCoachDraft(''), [])
  const { open: breakOpen, toggle: toggleBreak } = usePersistentToggle('skellyspeak_break', true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsPanel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!settingsOpen) return
    const dismiss = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[role="dialog"]')) return
      if (!settingsPanel.current?.contains(target as Node)) setSettingsOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
        setSettingsOpen(false)
        settingsPanel.current?.querySelector<HTMLButtonElement>('.chat-config-toggle')?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [settingsOpen])
  const words = useWordInspection({ pinTurn: setPinnedId, breakOpen, toggleBreak })
  // Panel reload counter: bumped when the coach thread is reset externally.
  const [threadReload, setThreadReload] = useState(0)


  const streamRef = useRef<HTMLDivElement | null>(null)
  const breakRef = useRef<HTMLDivElement | null>(null)

  const settingsRef = useRef<Settings | null>(null)
  settingsRef.current = settings
  const sendRef = useRef<(text: string) => Promise<void>>(async () => {})
  const toggleMicRef = useRef<() => void>(() => {})
  const toggleBreakRef = useRef<() => void>(() => {})

  const setHistoryOpen = useCallback(
    (open: boolean) => onHistoryOpenChange?.(open),
    [onHistoryOpenChange]
  )

  /// Everything tied to the conversation leaving the screen. The turns
  /// themselves are set by whoever swapped them.
  const resetView = useCallback(() => {
    setPinnedId(null)
    setCoachDraft('')
    setReviewing(new Set())
    clearWordsRef.current()
    setError(null)
    setSending(false)
    setEditingTurnId(null)
    stopSpeechRef.current()
    setThreadReload((v) => v + 1)
  }, [])

  // resetView is declared before the conversation controller.
  const clearWordsRef = useRef<() => void>(() => {})
  const {
    turns,
    chats,
    currentChatId,
    openChat,
    startNew: startNewConversation,
    removeChat,
    sendMessage,
    pendingReply,
    snapshotRevision,
    snapshot,
  } = useConversation({
    settings,
    setHistoryOpen,
    resetView,
  })

  const details = useConversationDetails(currentChatId, snapshotRevision)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [creatingConversation, setCreatingConversation] = useState(false)
  const creatingContactConversation = useRef(false)
  const [contactError, setContactError] = useState<string | null>(null)
  // A contact is the container; its entry shows the persona it speaks through.
  const contactChoices = (details.directory?.contacts ?? []).flatMap(contact => {
    const persona = details.directory?.personas.find(item => item.id === contact.personaId)
    return !contact.archived && persona && persona.languageId === settings?.target_language
      ? [{ id: contact.id, name: personaName(persona.details), symbol: persona.details.vibe[0] }]
      : []
  })
  const activeContactId = selectedContactId ?? details.contact?.id ?? contactChoices[0]?.id ?? ''
  const contactChats = chats.filter(chat => details.directory?.conversations.some(item => item.id === chat.id && item.contactId === activeContactId))
  async function createContactConversation(contactId: string) {
    if (creatingContactConversation.current) return
    creatingContactConversation.current = true; setCreatingConversation(true); setContactError(null)
    try { await details.beforeSend(); await openChat(await details.createConversation(contactId)) }
    catch (reason) { setContactError(nativeError(reason)) }
    finally { creatingContactConversation.current = false; setCreatingConversation(false) }
  }
  // Choosing a persona means choosing the contact it speaks through: open that
  // contact's most recent conversation, or give them one if they have none.
  async function chooseContact(contactId: string) {
    if (contactId === activeContactId || creatingContactConversation.current) return
    const conversations = (details.directory?.conversations ?? []).filter(item => item.contactId === contactId && !item.archived)
    const recent = conversations.sort((a, b) => b.lastUsed - a.lastUsed)[0]
    if (recent) { setSelectedContactId(contactId); await openChat(recent.id); return }
    await createContactConversation(contactId)
  }
  async function createPersona(next: PersonaDetails) {
    if (!settings || creatingContactConversation.current) return
    creatingContactConversation.current = true; setCreatingConversation(true); setContactError(null)
    try {
      await details.beforeSend()
      const conversation = await createContactRequest(settings.target_language, next)
      setNewPersonaOpen(false)
      await openChat(conversation)
    } catch (reason) { setContactError(nativeError(reason)); throw reason }
    finally { creatingContactConversation.current = false; setCreatingConversation(false) }
  }
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null)
  const editingPersona = details.directory?.personas.find(item => item.id === editingPersonaId)
  const [newPersonaOpen, setNewPersonaOpen] = useState(false)
  // The tab shows the persona being talked to. Creating another belongs to the
  // header picker, so nothing here can overwrite this one by accident.
  const personaProfile = details.persona ? <>
    <div className="persona-tab-actions">
      <button type="button" className="btn" onClick={() => setEditingPersonaId(details.persona!.id)}>Edit persona</button>
    </div>
    <PersonaProfile key={details.persona.id} persona={details.persona}
      language={targetLanguageLabel(details.persona.languageId)} romanized={Boolean(languageFor(details.persona.languageId)?.romanization)} onSave={details.savePersona} />
  </> : <p className="center-note">Persona is unavailable.</p>
  function targetLanguageLabel(id: string) { return details.directory?.languages.find(item => item.id === id)?.name ?? id }



  useEffect(() => {
    logInfo('[guided] page mounted, isTauri =', isTauri)
    // A settings **save** supersedes the missing-provider banner. The revision is
    // zero until a write lands, so a first read never clears a real failure.
    if (settingsVersion > 0 && errorRef.current && needsProviderSetup(errorRef.current)) {
      errorRef.current = null
      setError(null)
    }
  }, [settingsVersion, currentChatId])

  // The record describes the active conversation's scope, so switching chats
  // re-reads it. This does not bump the revision: nothing was written.
  useEffect(() => {
    void useSettingsStore.getState().load().catch((error: unknown) => reportFault('Loading settings', error))
  }, [currentChatId])

  useEffect(() => {
    const el = streamRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns])

  const isMobile = useIsMobile()
  const [analysisOpen, setAnalysisOpen] = useState(false)
  useEffect(() => { setAnalysisOpen(false) }, [currentChatId, settingsVersion])

  const onBubbleTap = useCallback(
    (id: number) => {
      setPinnedId(id)
      setAnalysisOpen(true)
    },
    []
  )
  const acceptingSend = useRef(false)
  useEffect(() => setSending(pendingReply), [pendingReply, snapshotRevision])
  const requestTurn = useCallback(async (body: { message?: string; replacesMessageId?: number; inputEvidence?: InputEvidence }) => {
    if (body.replacesMessageId !== undefined) {
      setError('This action is not connected yet.')
      return
    }
    const text = body.message?.trim()
    if (!text || acceptingSend.current) return
    acceptingSend.current = true
    const submittedDraftRevision = inputRevision.current
    setSending(true)
    setError(null)
    try {
      await details.beforeSend()
      await sendMessage(text, currentChatId, body.inputEvidence)
    } catch (error) {
      setError(nativeError(error))
      if (inputRevision.current === submittedDraftRevision) setInput(text)
      setSending(false)
    } finally { acceptingSend.current = false }
  }, [sendMessage, details.beforeSend, currentChatId])

  async function send(text: string) {
    const message = text.trim()
    if (!message || sending) return
    const provenance = { ...inputEvidence.current, revision: editingTurnId !== null }
    inputEvidence.current = unreportedInput()
    setInput('')
    stopSpeechRef.current() // new turn: silence any ongoing playback
    const replacesMessageId = editingTurnId ?? undefined
    await requestTurn({ message, replacesMessageId, inputEvidence: provenance })
  }
  sendRef.current = send

  const cancelEdit = useCallback(() => {
    inputEvidence.current = unreportedInput()
    setEditingTurnId(null)
    setInput('')
  }, [])
  toggleBreakRef.current = toggleBreak
  // Configurable keyboard shortcuts. Modifier combos work while typing;
  // the handler ignores repeat events and the shortcut-capture inputs.
  useEffect(() => {
    const shortcuts = settings?.shortcuts
    if (!shortcuts) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      const target = e.target as HTMLElement | null
      if (target?.closest?.('[data-shortcut-capture]')) return
      const combo = comboFromEvent(e)
      const inField = /^(input|textarea|select)$/i.test(target?.tagName ?? '')
      const hasMod = e.ctrlKey || e.altKey || e.metaKey
      if (!hasMod && inField) return
      if (combo === shortcuts.mic) {
        e.preventDefault()
        toggleMicRef.current()
      } else if (combo === shortcuts.panel) {
        e.preventDefault()
        toggleBreakRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settings?.shortcuts])

  const editingTurn = turns.find((turn) => turn.id === editingTurnId)
  const latestAssistantId = latestAnswered(turns)?.id ?? null

  // Romanization shows for targets whose script needs it (Arabic → ALA-LC).
  const showRomanization =
    settings != null && languageFor(settings.target_language)?.romanization != null

  // RTL targets render token lines right-to-left.
  const rtl =
    settings != null && languageFor(settings.target_language)?.direction === 'rtl'

  // Romanization visibility: "always" setting OR a revealed token.
  const alwaysRomanize = settings?.always_romanize ?? false

  useEffect(() => {
    onNewChatReady?.(settings && !sending ? () => { void startNewConversation() } : null)
    return () => onNewChatReady?.(null)
  }, [onNewChatReady, settings, sending, startNewConversation])

  const savingReading = useSettingsStore((state) => state.savingPreference)
  const toggleSetting = useSettingsStore((state) => state.setPreference)

  const targetLanguage = settings ? languageFor(settings.target_language) : null
  const nativeLanguage = settings ? languageFor(settings.native_language) : null
  const targetLanguageName = targetLanguage ? languageLabel(targetLanguage) : ''
  const nativeLanguageName = nativeLanguage ? languageLabel(nativeLanguage) : ''
  const romanized = Boolean(targetLanguage?.romanization)
  const pinnedTurn = turns.find(t => t.id === (pinnedId ?? latestAssistantId) && t.assistant) ?? null

  clearWordsRef.current = words.clear

  const mic = useMicRecorder({
    conversationId: active ? currentChatId : null,
    onTranscribe: (text: string) => {
      if (text) {
        inputEvidence.current.modality = 'speech_transcript'
        if (settingsRef.current?.auto_send && !sending) {
          logInfo('[mic] auto-send enabled — sending transcription')
          void sendRef.current(text)
        } else {
          setInput((prev) => (prev ? `${prev} ${text}` : text))
        }
      } else logWarn('[mic] transcription was empty (silence?)')
    },
  })
  const speech = useMessageSpeech(snapshot, currentChatId, Boolean(settings?.auto_speak) && !mic.recording && !mic.transcribing, active, settings?.tts_rate ?? 1, (settings?.master_volume ?? 100) * (settings?.voice_volume ?? 100) / 10000)
  stopSpeechRef.current = speech.stop
  const toggleMic = () => { speech.stop(); void mic.toggleMic() }
  toggleMicRef.current = toggleMic

  const aiBusy = pendingReply

  useEffect(() => { if (words.inspect) setAnalysisOpen(true) }, [words.inspect])

  useEffect(() => {
    if (isMobile && mobileSurface === 'panel') breakRef.current?.scrollIntoView({ block: 'start' })
  }, [isMobile, mobileSurface, panelTab])
  const chatComposer = (
        <div className="composer" ref={composer}>
          {editingTurnId !== null && (
            <div className="edit-banner">
              <span>✎ Editing your message — send or record to try again</span>
              <button type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          )}
          {editingTurn && <EditFeedback key={editingTurn.id} id={editingTurn.id} feedback={editingTurn.coach} error={editingTurn.coachError} reviewing={reviewing.has(editingTurn.id)} />}
          <div className="composer-activity" aria-live="polite">
            {mic.transcribing ? <ActivityIndicator label="Transcribing…" /> : sending ? <ActivityIndicator label="Replying…" /> : (aiBusy || turns.some(turn => turn.analysisState === 'pending') || reviewing.size > 0) ? <ActivityIndicator label="Analysing…" /> : null}
          </div>
          {mic.recording && mic.waveSource && (
            <WaveformStrip source={mic.waveSource} height={44} timelineSeconds={10} />
          )}
          {<ComposerHelp
            key={`${currentChatId}:${turns.at(-1)?.id}`}
            busy={sending}
            replies={turns.at(-1)?.assistant?.scaffolds.replies ?? []}
            pending={['ready', 'running', 'waiting_dependencies'].includes(turns.at(-1)?.assistant?.suggestionsState ?? '')}
            errors={turns.at(-1)?.assistant?.errors ?? []}
            onUse={(text, source) => {
              inputEvidence.current = { ...inputEvidence.current, [source]: true }
              setInput(previous => previous.trim() ? `${previous.trimEnd()} ${text}` : text)
              composer.current?.querySelector<HTMLInputElement>('.field')?.focus()
            }} />}
          <ComposerInput input={input} available={isTauri} sending={sending}
            recording={mic.recording} transcribing={mic.transcribing} autoSend={settings?.auto_send ?? false}
            targetLanguage={settings?.target_language ?? 'es-ES'} targetLanguageName={targetLanguageName}
            onInput={setInput} onSend={text => { void send(text) }}
            onDiscardRecording={mic.cancel} onToggleRecording={toggleMic} />
        </div>
  )

  return (
    <ReadingPreferencesProvider settings={settings}><RewardPresentationProvider fastMode={settings?.fast_mode ?? true} workspace={workspace} chatId={currentChatId} active={active}><PracticeContext value={{ chatId: currentChatId, selectionVersion, selected: skillSelection && skillSelection.target === settings?.target_language ? skillSelection.skillId : null, select: skillId => { if (!settings) throw new Error('Settings are not loaded'); selectSkill({ target: settings.target_language, skillId }) } }}>
    <div className="guided-workspace">
    <div
      ref={workspace}
      className={`split ${isMobile ? 'mobile-conversation' : ''} ${isMobile && mobileSurface === 'panel' ? 'mobile-lesson' : ''}`}
    >
      <ChatHistory
        open={historyOpen}
        chats={contactChats}

        currentId={currentChatId}
        languageName={targetLanguageName}
        onClose={() => setHistoryOpen(false)}
        onOpenChat={(id) => void openChat(id)}
        onNewChat={() => void startNewConversation()}
        onDeleteChat={(id) => void removeChat(id)}
      />
      {/* ── Chat half (paper) ─────────────────────────────────────────── */}
      <section className="chat" data-stripe={Array.from(currentChatId ?? '').reduce((sum, char) => sum + char.charCodeAt(0), 0) % CHAT_STRIPES}>
        <ConversationHeader learning={learningPicker} persona={<PersonaPicker choices={contactChoices} currentId={activeContactId}
          busy={creatingConversation} onSelect={id => { void chooseContact(id) }} onEdit={() => setEditingPersonaId(details.persona?.id ?? null)} onCreate={() => setNewPersonaOpen(true)} />} difficulty={details.conversation?.settings.difficulty} saving={details.saving} error={details.error} onDifficulty={details.saveDifficulty}>
          <div className="chat-heading-actions">
          <div className="chat-config" ref={settingsPanel}>
            <button type="button" className="chat-config-toggle" aria-label="Settings & voice" aria-expanded={settingsOpen} aria-controls="chat-settings" title={settingsOpen ? 'Hide chat settings' : 'Show chat settings'} onClick={() => setSettingsOpen(open => !open)}>⚙</button>
            {settingsOpen && <div id="chat-settings" className="scaffold-groups chat-config-panel" role="region" aria-label="Chat settings">
                <div className="conversation-languages">{nativePicker}</div>
                {/* The same Settings record the modal edits — Rust owns it,
                    these are a second VIEW of one variable, not a copy. */}
                <div className="quick-toggles" role="group" aria-label="Reading and voice options">
                  {(
                    [
                      ['auto_speak', 'Read aloud', 'Speak each reply automatically'],
                      ['auto_send', 'Auto-send', 'Send speech transcriptions immediately'],
                      ['auto_translate', 'Translation', 'Always show the translation under each reply'],
                      ['always_pronunciation', 'Pronunciation', 'Show saved pronunciation in replies and coach advice'],
                      ['fast_mode', 'Fast mode', 'Automatically dismiss new XP cards; point icons reopen them'],
                      ...(showRomanization
                        ? ([['always_romanize', 'Romanization', 'Always show romanization under each word']] as const)
                        : []),
                    ] as [
                      'auto_speak' | 'auto_send' | 'auto_translate' | 'always_romanize' | 'always_pronunciation' | 'fast_mode',
                      string,
                      string,
                    ][]
                  ).map(([key, label, title]) => (
                    <button
                      key={key}
                      type="button"
                      className={`quick-toggle ${settings?.[key] ? 'on' : ''}`}
                      onClick={() => void toggleSetting(key)}
                      aria-pressed={settings?.[key] ?? false}
                      title={title}
                      disabled={!settings || savingReading}
                    >
                      {settings?.[key] ? '☑' : '☐'} {label}
                    </button>
                  ))}
                  <label className="speech-speed">
                    Voice speed
                    <select aria-label="Voice playback speed" value={settings?.tts_rate ?? 1} disabled={!settings || savingReading} onChange={event => void toggleSetting('tts_rate', Number(event.target.value))}>
                      {[0.5, 0.65, 0.8, 1, 1.25, 1.5].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
                    </select>
                  </label>
                </div>

              </div>
            }
          </div>



          </div>
        </ConversationHeader>
        <SkillRewards chatId={currentChatId} active={active} />
        <div className="stream" ref={streamRef}>
          {turns.length === 0 && !error && !sending && connection?.configured === false ? (
            <div className="access-start">
              <p>You’re not signed in.</p>
              <button type="button" className="btn primary" disabled={signingIn} onClick={() => void startHostedSignIn()}>
                {signingIn ? 'Signing in…' : 'Sign in with Google'}
              </button>
            </div>
          ) : turns.length === 0 && !error && !sending && (
            <p className="center-note on-paper">
              Say hello to start the conversation.
            </p>
          )}
          {turns.map((turn) => (
            <Fragment key={turn.id}><TurnView
              turn={turn}
              onRetryGloss={async operationId => { await executeAction(await readWorkspace(), { kind: 'retryGloss', operationId }) }}
              reviewing={turn.analysisState === 'pending' || reviewing.has(turn.id)}
              onAskCoach={setCoachDraft}
              focused={(pinnedId ?? latestAssistantId) === turn.id}
              ttsReady={isTauri && Boolean(turn.assistant?.messageId)}
              speaking={Boolean(turn.assistant?.messageId && speech.messageId === turn.assistant.messageId)}
              speechError={speech.failure?.messageId === turn.assistant?.messageId ? speech.failure?.text : undefined}
              onSpeak={() => { if (turn.assistant?.messageId) speech.toggle(turn.assistant.messageId) }}
              revealed={words.revealed}
              showRomanization={showRomanization}
              alwaysRomanize={alwaysRomanize}
              alwaysPronunciation={settings?.always_pronunciation ?? false}
              autoTranslate={settings?.auto_translate ?? false}
              rtl={rtl}
              onReveal={words.reveal}
              onBubbleTap={onBubbleTap}
              onPopup={words.setPopup}
              onInspect={words.inspectWord}
              onToggleReveal={words.toggleReveal}
              onEditUser={undefined}
            />
            </Fragment>
          ))}
          {error && (
            <ErrorDetails label="Request failed" errorKey={error}>
              <div>{error}</div>
              {/* A message that says "go to Settings" should take you there,
                  rather than making you find the gear yourself. */}
              {onOpenSettings && needsProviderSetup(error) && (
                <button type="button" className="err-action" onClick={onOpenSettings}>
                  Open Settings
                </button>
              )}
            </ErrorDetails>
          )}
        </div>

        {!isMobile && chatComposer}
      </section>

      {isMobile && <div className="chat mobile-composer">{chatComposer}</div>}

      {/* ── Breakdown half (dark) — full panel in mobile Coach/Analysis mode ── */}
      <section
        className={`break ${breakOpen || isMobile ? '' : 'collapsed'}`}
        ref={breakRef}
      >
        {!breakOpen && !isMobile && <button type="button" className="break-head" onClick={toggleBreak} aria-expanded={false}>Open XP &amp; coach ▸</button>}

        {/* Lesson choices and private coaching share the learning panel. */}
        {currentChatId && <CoachAnalysisPanel
          key={`${currentChatId}:${settings?.target_language}:${settings?.native_language}:${threadReload}`}
          chatId={currentChatId}
          conversationBusy={sending || details.saving}
          personaProfile={personaProfile}
          tab={panelTab}
          onTab={setPanelTab}
          draftQuestion={coachDraft}
          onDraftConsumed={consumeCoachDraft}
          pinnedTurn={pinnedTurn}
          inspect={words.inspect}
          nativeLanguageName={nativeLanguageName}
          showRomanization={showRomanization}
          rtl={rtl}
        />}

      </section>

    </div>

      {contactError && <ErrorDetails label="Contact" errorKey={contactError}>{contactError}</ErrorDetails>}
      {newPersonaOpen && settings && <NewPersonaDialog key="new-persona" language={settings.target_language} romanized={romanized} busy={creatingConversation}
        onCreate={createPersona} onClose={() => setNewPersonaOpen(false)} />}
      {editingPersona && <PersonaProfileDialog key={editingPersona.id} persona={editingPersona} language={targetLanguageLabel(editingPersona.languageId)} romanized={Boolean(languageFor(editingPersona.languageId)?.romanization)} onSave={details.savePersona} onNewPersona={() => { setEditingPersonaId(null); setNewPersonaOpen(true) }} onClose={() => setEditingPersonaId(null)} />}
      {analysisOpen && <DetailDialog title="Message analysis" onClose={() => setAnalysisOpen(false)}>
        <h2>Message analysis</h2>
        {pinnedTurn ? <AnalysisContent turn={pinnedTurn} inspect={words.inspect} nativeLanguageName={nativeLanguageName} showRomanization={showRomanization} rtl={rtl} /> : <p>Select Analysis on a conversation reply to inspect that message.</p>}
      </DetailDialog>}
      {words.popup && <GlossPopup popup={words.popup} onClose={words.closePopup} />}

    </div>
    </PracticeContext></RewardPresentationProvider></ReadingPreferencesProvider>
  )
}
