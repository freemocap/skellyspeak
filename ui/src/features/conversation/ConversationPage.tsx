import { ConversationErrorScope } from './reading/ConversationErrorScope'
import { ConversationReadingProvider } from './reading/ConversationReadingProvider'
import { interruptSpeech } from '../../platform/audio/speech'
import { ConversationHelp } from './composer/ConversationHelp'
import { ConversationDirectionSettings } from './session/ConversationDirectionSettings'
import { useAttemptStreamSync } from '../../state/session/attempt-streams'
import type { ConversationStartConfig } from '../../generated/contracts'
import { AskCoachContext } from '../../components/learning/AskCoachButton'
import { useI18n } from '../../components/localization/i18n'
import { TranscriptionInspector } from './speech/TranscriptionInspector'
import { ConversationExport } from './session/ConversationExport'
import { PracticeDivider } from './messages/PracticeDivider'
import { LiveCoachReview } from './coaching/LiveCoachReview'
import { OpeningStatus } from './session/OpeningStatus'
import { useNavigationStore } from '../../state/navigation/navigation'
import { ConversationStart } from './session/ConversationStart'
import { PersonaProfileDialog } from './partners/PersonaProfileDialog'
import { DifficultySelect, difficultyLabel } from '../../components/controls/DifficultySelect'
import { ConversationHeader } from './session/ConversationHeader'
import { ConversationSettings } from './session/ConversationSettings'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { NewPersonaDialog } from './partners/NewPersonaDialog'
import { PersonaPicker } from './partners/PersonaPicker'
import { useConversationDetails } from './session/useConversationDetails'
import { ComposerInput } from './composer/ComposerInput'
import { ErrorDetails } from '../../components/feedback/ErrorDetails'
import { ReadingPreferencesProvider } from '../../components/reading/ReadingPreferences'
import { configureRewardSounds, stopRewardSounds } from '../../platform/audio/reward-sounds'
import { RewardPresentationProvider } from './progress/RewardPresentation'
import { ActivityIndicator } from '../../components/feedback/ActivityIndicator'
import { TurnReplyHelp } from './composer/TurnReplyHelp'
import { useSkillNavigationStore } from '../../state/navigation/skill-navigation'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createContact as createContactRequest, executeAction, readWorkspace, nativeError } from '../../platform/ipc/workspace'
import type { Settings } from '../../types'
import type { PersonaDetails } from '../../generated/contracts'
import { unreportedInput, type InputEvidence } from '../../domain/learning/evidence/skills'
import { PracticeContext } from './session/PracticeContext'
import { SkillRewards } from './progress/SkillRewards'
import { isTauri, languageFor } from '../../platform/ipc/tauri'
import { languageLabel } from '../../domain/language/language-label'
import { personaName } from './partners/personaLimits'
import { useSettingsStore } from '../../state/settings/settings'
import { useSessionStore } from '../../state/session/session'
// Where the narrow-window layout puts the learner: the shell's navigation state
// decides it, so the type lives with that state.
import type { MobileLocation } from '../../state/navigation/navigation'
import { useMessageSpeech } from './speech/useMessageSpeech'
import { comboFromEvent } from '../../domain/input/keyboard'
import { WaveformStrip } from '../../components/media/WaveformStrip'
import { EditFeedback } from './coaching/EditFeedback'
import { TurnView } from './messages/TurnView'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { AnalysisContent } from './reading/AnalysisContent'
import { CoachAnalysisPanel } from './coaching/CoachAnalysisPanel'
import { logInfo, logWarn } from '../../platform/diagnostics/log'
import { ChatHistory } from './session/ChatHistory'
import { latestAnswered } from '../../domain/conversation/turns'
import { useConversation } from './session/useConversation'
import { useConversationScroll } from './messages/useConversationScroll'
import { useMicRecorder } from '../../platform/audio/useMicRecorder'
import { usePersistentToggle } from '../../components/persistence/usePersistentToggle'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { reportFault } from '../../platform/diagnostics/faults'
import { needsProviderSetup } from '../../domain/access/providers'

/// Number of conversation stripe hues: the .chat[data-stripe] rules in
/// conversation/message styles and the --chat-stripe-* tokens in tokens.css.
const CHAT_STRIPES = 5

export default function ConversationPage({
  active,
  nativePicker,
  mobileSurface,
  historyOpen = false,
  onHistoryOpenChange,
  onOpenSettings,
  onNewChatReady,
}: {
  active: boolean
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
  const tr = useI18n()
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
  // A repair retains its source and explicitly confirms removal of dependent turns.
  const [editingTurnId, setEditingTurnId] = useState<number | null>(null)
  const [acceptedEditSource, setAcceptedEditSource] = useState<string | null>(null)
  const [editRevision, setEditRevision] = useState<number | null>(null)
  const [revisionConfirmation, setRevisionConfirmation] = useState<{ text: string; input: InputEvidence; revision: number; exchangeCount: number } | null>(null)
  const connection = useSessionStore((state) => state.connection)
  const signingIn = useSessionStore((state) => state.signingIn)
  const startHostedSignIn = useSessionStore((state) => state.startHostedSignIn)
  const settings = useSettingsStore((state) => state.settings)
  // Bumped when a settings **write** lands. Switching conversations reloads the
  // record without bumping it: a different scope is not a settings change.
  const settingsVersion = useSettingsStore((state) => state.revision)
  useEffect(() => {
    if (settings) configureRewardSounds(settings.xp_effects === false ? 'no' : settings.reward_sounds, settings.auto_speak)
    if (!active) stopRewardSounds()
  }, [settings?.xp_effects, settings?.reward_sounds, settings?.auto_speak, active])
  useEffect(() => () => stopRewardSounds(), [])
  const [panelTab, setPanelTab] = useState<'coaching' | 'evidence'>('coaching')
  const [coachDraft, setCoachDraft] = useState('')
  const mode = useNavigationStore(state => state.mode)
  const [reviewing, setReviewing] = useState<Set<number>>(new Set())
  const consumeCoachDraft = useCallback(() => setCoachDraft(''), [])
  const { open: breakOpen, toggle: toggleBreak } = usePersistentToggle('skellyspeak_break', true)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
    setError(null)
    setSending(false)
    setEditingTurnId(null)
    setAcceptedEditSource(null)
    setRevisionConfirmation(null)
    stopSpeechRef.current()
    setThreadReload((v) => v + 1)
  }, [])

  const {
    turns,
    chats,
    currentChatId,
    openChat,
    startNew: startNewConversation,
    removeChat,
    sendMessage,
    pendingReply,
    replyActive,
    snapshotRevision,
    readError, retryRead, olderError, loadingOlder, loadOlder,
    snapshot,
  } = useConversation({
    settings,
    setHistoryOpen,
    resetView,
  })

  const selectedChatRef = useRef(currentChatId)
  selectedChatRef.current = currentChatId
  const details = useConversationDetails(currentChatId, snapshotRevision)
  useAttemptStreamSync(currentChatId)
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
  const activeContactId = details.contact?.id ?? ''
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
    if (recent) {
      creatingContactConversation.current = true; setCreatingConversation(true); setContactError(null)
      try { await details.beforeSend(); await openChat(recent.id) }
      catch (reason) { setContactError(nativeError(reason)) }
      finally { creatingContactConversation.current = false; setCreatingConversation(false) }
      return
    }
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

  const onStreamScroll = useConversationScroll(streamRef, currentChatId, snapshot?.messages[0]?.sequence, turns)

  const isMobile = useIsMobile()
  function openCoach(id?: number) {
    if (id !== undefined) setPinnedId(id)
    setPanelTab('coaching')
    if (!breakOpen) toggleBreak()
    if (isMobile) useNavigationStore.getState().openPractice('panel')
    requestAnimationFrame(() => breakRef.current?.querySelector<HTMLTextAreaElement>('.coach-input')?.focus())
  }
  const [exportOpen, setExportOpen] = useState(false)
  const [inspectionOpen, setInspectionOpen] = useState(false)
  useEffect(() => setInspectionOpen(false), [currentChatId, active])
  const [analysisOpen, setAnalysisOpen] = useState(false)
  function askCoach(question: string) {
    setAnalysisOpen(false)
    setCoachDraft(question)
    openCoach()
  }
  useEffect(() => { setAnalysisOpen(false) }, [currentChatId, settingsVersion])
  const readingSettingsBusy = useNavigationStore(state => state.settingsBusy)
  const readingOverlay = useNavigationStore(state => state.overlay)
  const readingQuestion = useNavigationStore(state => state.readingQuestion)
  useEffect(() => {
    if (!readingQuestion || !active || !currentChatId || readingSettingsBusy || readingOverlay) return
    askCoach(readingQuestion)
    useNavigationStore.getState().draftReadingQuestion(null)
  }, [readingQuestion, active, currentChatId, readingSettingsBusy, readingOverlay])


  const onBubbleTap = useCallback(
    (id: number) => {
      setPinnedId(id)
      setAnalysisOpen(true)
    },
    []
  )
  const [startDraft, setStartDraft] = useState<{ id: string; value: ConversationStartConfig } | null>(null)
  const startConfiguration = startDraft?.id === currentChatId ? startDraft.value : details.conversation ? {
    difficulty: details.conversation.settings.difficulty, varietyId: details.conversation.settings.varietyId, direction: details.conversation.settings.direction,
  } : null
  const acceptingSend = useRef(false)
  useEffect(() => setSending(pendingReply || acceptedEditSource !== null), [pendingReply, snapshotRevision, acceptedEditSource])
  useEffect(() => {
    if (acceptedEditSource && turns.some(turn => turn.replacesTurnId === acceptedEditSource)) {
      setAcceptedEditSource(null)
      setEditingTurnId(null)
    }
  }, [acceptedEditSource, turns])
  async function submitText(text: string, provenance: InputEvidence, revision?: number) {
    if (acceptingSend.current) return
    acceptingSend.current = true
    const submittedChatId = currentChatId
    const submittedDraftRevision = inputRevision.current
    let editedSource: string | null = null
    setSending(true)
    setError(null)
    try {
      await details.beforeSend()
      if (selectedChatRef.current !== submittedChatId) return
      if (editingTurnId !== null) {
        const turn = turns.find(item => item.id === editingTurnId)
        if (!turn?.turnId || !snapshot || revision === undefined) throw new Error('Revision source is unavailable. Reopen the message to edit it.')
        await executeAction(snapshot, { kind: 'reviseTurn', conversationId: snapshot.conversationId, turnId: turn.turnId, text, input: provenance, expectedRevision: revision })
        editedSource = turn.turnId
      } else if (snapshot && !snapshot.opening && turns.length === 0) {
        if (!startConfiguration) throw new Error('Conversation settings are unavailable.')
        const latest = await readWorkspace()
        if (selectedChatRef.current !== submittedChatId) return
        await executeAction(latest, { kind: 'startConversation', conversationId: snapshot.conversationId, configuration: startConfiguration, message: text, input: provenance, expectedRevision: latest.revision })
      } else await sendMessage(text, currentChatId, provenance)
      if (selectedChatRef.current !== submittedChatId) return
      if (inputRevision.current === submittedDraftRevision) {
        setInput('')
        inputEvidence.current = unreportedInput()
      }
      if (editedSource) setAcceptedEditSource(editedSource)
      else setEditingTurnId(null)
      setRevisionConfirmation(null)
    } catch (reason) {
      if (selectedChatRef.current !== submittedChatId) return
      setError(nativeError(reason))
      if (inputRevision.current === submittedDraftRevision) setInput(text)
      setRevisionConfirmation(null)
      setEditRevision(null)
      setSending(false)
    } finally { acceptingSend.current = false }
  }

  async function startConversation(configuration: ConversationStartConfig) {
    if (acceptingSend.current || sending) throw new Error('A conversation action is already pending.')
    if (!snapshot || snapshot.conversationId !== currentChatId) throw new Error('The conversation is not ready.')
    const reviewed = snapshot
    const owner = currentChatId
    acceptingSend.current = true
    setSending(true)
    try {
      await details.beforeSend()
      if (selectedChatRef.current !== owner) throw new Error('The conversation changed before starting.')
      const latest = await readWorkspace()
      if (selectedChatRef.current !== owner) throw new Error('The conversation changed before starting.')
      await executeAction(latest, { kind: 'startConversation', conversationId: reviewed.conversationId, configuration, message: null, input: null, expectedRevision: latest.revision })
    } catch (reason) {
      if (selectedChatRef.current === owner) setSending(false)
      throw reason
    } finally { acceptingSend.current = false }
  }

  async function send(text: string) {
    const message = text.trim()
    if (!message || acceptingSend.current || (sending && editingTurnId === null)) return
    const provenance = { ...inputEvidence.current, revision: editingTurnId !== null }
    stopSpeechRef.current()
    if (editingTurnId !== null) {
      const turn = turns.find(item => item.id === editingTurnId)
      const scope = snapshot?.revisionSuffixCounts.find(item => item.turnId === turn?.turnId)
      if (!scope || !snapshot) { setError('Revision source is unavailable. Reopen the message to edit it.'); return }
      // A failed admission requires a fresh native preview; the draft stays intact.
      const revision = editRevision ?? snapshot.revision
      if (scope.exchangeCount) {
        setRevisionConfirmation({ text: message, input: provenance, revision, exchangeCount: scope.exchangeCount })
        return
      }
      await submitText(message, provenance, revision)
    } else await submitText(message, provenance)
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

  const activeTurns = turns.filter(turn => !turn.replacedBy)
  const editingTurn = turns.find((turn) => turn.id === editingTurnId)
  const latestAssistantId = latestAnswered(activeTurns)?.id ?? null

  // Romanization shows for targets whose script needs it (Arabic → ALA-LC).
  const showRomanization =
    settings != null && languageFor(settings.target_language, settings.target_variety)?.romanization != null

  // RTL targets render message lines right-to-left.
  const rtl =
    settings != null && languageFor(settings.target_language, settings.target_variety)?.direction === 'rtl'

  useEffect(() => {
    onNewChatReady?.(settings && !sending ? () => { void startNewConversation() } : null)
    return () => onNewChatReady?.(null)
  }, [onNewChatReady, settings, sending, startNewConversation])

  const savingReading = useSettingsStore((state) => state.savingPreference)
  const toggleSetting = useSettingsStore((state) => state.setPreference)

  const targetLanguage = settings ? languageFor(settings.target_language, settings.target_variety) : null
  const nativeLanguage = settings ? languageFor(settings.native_language, settings.native_variety) : null
  const targetLanguageName = targetLanguage ? languageLabel(targetLanguage, tr.locale) : ''
  const nativeLanguageName = nativeLanguage ? languageLabel(nativeLanguage, tr.locale) : ''
  const romanized = Boolean(targetLanguage?.romanization)
  const pinnedTurn = activeTurns.find(t => t.id === (pinnedId ?? latestAssistantId) && t.assistant) ?? null


  const mic = useMicRecorder({
    owner: active && currentChatId ? { kind: 'conversation', id: currentChatId } : null,
    onTranscribe: (text: string) => {
      if (text) {
        inputEvidence.current.modality = 'speech_transcript'
        if (settingsRef.current?.auto_send && (!sending || editingTurnId !== null)) {
          logInfo('[mic] auto-send enabled — sending transcription')
          void sendRef.current(text)
        } else {
          setInput((prev) => (prev ? `${prev} ${text}` : text))
        }
      } else logWarn('[mic] transcription was empty (silence?)')
    },
  })
  const speech = useMessageSpeech(snapshot, currentChatId, Boolean(settings?.auto_speak) && !mic.recording && !mic.transcribing, active, settings?.tts_rate ?? 1, (settings?.master_volume ?? 100) * (settings?.voice_volume ?? 100) / 10000)
  stopSpeechRef.current = () => { speech.stop(); interruptSpeech() }
  const toggleMic = () => { stopSpeechRef.current(); void mic.toggleMic() }
  toggleMicRef.current = toggleMic

  const aiBusy = replyActive


  useEffect(() => {
    if (isMobile && mobileSurface === 'panel') breakRef.current?.scrollIntoView({ block: 'start' })
  }, [isMobile, mobileSurface, panelTab])
  const latestTurn = activeTurns.at(-1)
  const replyHelp = (
    <ConversationErrorScope conversationId={snapshot?.conversationId} turn={latestTurn?.execution}>
      <TurnReplyHelp turn={latestTurn} conversationId={snapshot?.conversationId} onAsk={askCoach} busy={sending}
        onUse={(text, source) => {
          inputEvidence.current = { ...inputEvidence.current, [source]: true }
          setInput(previous => previous.trim() ? `${previous.trimEnd()} ${text}` : text)
          composer.current?.querySelector<HTMLTextAreaElement>('.field')?.focus()
        }} />
    </ConversationErrorScope>
  )
  const chatComposer = (
        <div className="composer" ref={composer}>
          {editingTurnId !== null && (
            <div className="edit-banner">
              <span>{acceptedEditSource ? tr("Edit saved — updating conversation…") : tr("✎ Editing your message — send to replace it")}</span>
              <button type="button" disabled={acceptedEditSource !== null} onClick={cancelEdit}>
                {tr("Cancel")}</button>
            </div>
          )}
          {editingTurn && !acceptedEditSource && <EditFeedback onControl={snapshot && editingTurn.turnId ? async control => {
            await executeAction(snapshot, { kind: 'coachControl', turnId: editingTurn.turnId!, control, expectedRevision: snapshot.revision })
          } : undefined} conversationFeedback={editingTurn.conversationFeedback} key={editingTurn.id} decision={editingTurn.coachDecision} feedback={editingTurn.coach} error={editingTurn.coachError} reviewing={reviewing.has(editingTurn.id)} />}
          <div className="composer-activity" aria-live="polite">
            {mic.transcribing ? <ActivityIndicator label={tr("Transcribing…")} /> : sending && (!pendingReply || replyActive) ? <ActivityIndicator label={tr("Replying…")} /> : (aiBusy || activeTurns.some(turn => turn.analysisState === 'pending') || reviewing.size > 0) ? <ActivityIndicator label={tr("Analysing…")} /> : null}
          </div>
          {mic.lastTranscription && <button className="inspection-open" onClick={() => setInspectionOpen(true)}>{tr("Inspect recording")}</button>}
          {connection?.configured && <ConversationHelp hasReply={activeTurns.some(turn => !!turn.assistant)} hasLearnerTurn={activeTurns.some(turn => !!turn.user)} />}
          {isMobile && replyHelp}
          <ComposerInput waveform={mic.recording && mic.waveSource ? <WaveformStrip source={mic.waveSource} height={44} timelineSeconds={10} /> : null} micShortcut={settings?.shortcuts.mic} input={input} available={isTauri && connection?.configured === true} sending={editingTurnId !== null ? acceptingSend.current || acceptedEditSource !== null : sending}
            recording={mic.recording} transcribing={mic.transcribing} autoSend={settings?.auto_send ?? false}
            targetLanguageTag={targetLanguage?.languageTag} targetLanguageName={targetLanguageName}
            onInput={setInput} onSend={text => { void send(text) }}
            onDiscardRecording={mic.cancel} onToggleRecording={toggleMic} />
        </div>
  )

  return (
    <ConversationReadingProvider snapshot={snapshot} conversation={details.conversation}><AskCoachContext value={askCoach}><ReadingPreferencesProvider settings={settings}><RewardPresentationProvider enabled={settings?.xp_effects !== false} fastMode={settings?.fast_mode ?? true} workspace={workspace} chatId={currentChatId} active={active}><PracticeContext value={{ chatId: currentChatId, selectionVersion, selected: skillSelection && skillSelection.target === settings?.target_language ? skillSelection.skillId : null, select: skillId => { if (!settings) throw new Error('Settings are not loaded'); selectSkill({ target: settings.target_language, skillId }) } }}>
    <div className="guided-workspace">
    <div
      ref={workspace}
      className={`split ${isMobile ? 'mobile-conversation' : ''} ${isMobile && mobileSurface === 'panel' ? 'mobile-coach' : ''}`}
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
        <ConversationHeader persona={<PersonaPicker choices={contactChoices} currentId={activeContactId}
          busy={creatingConversation} onSelect={id => { void chooseContact(id) }} onEdit={() => setEditingPersonaId(details.persona?.id ?? null)} onCreate={() => setNewPersonaOpen(true)} />} error={details.error}>
          <div className="chat-heading-actions">
          {/* The settings summary rides on the button that changes them; under the
              persona it invited a click that only offered persona choices. */}
          <ConversationSettings summary={[details.conversation ? tr(difficultyLabel(details.conversation.settings.difficulty)) : null, settings?.auto_speak ? tr("Reading aloud") : null].filter(Boolean).join(' · ')} open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} saving={savingReading} onToggle={toggleSetting}
            nativePicker={nativePicker} showRomanization={showRomanization} exportDisabled={!currentChatId} onExport={() => setExportOpen(true)}
            promptControls={snapshot?.opening && details.conversation && <ConversationDirectionSettings conversationId={snapshot.conversationId} topics={snapshot.topicChoices} direction={details.conversation.settings.direction} />}
            difficulty={details.conversation && <DifficultySelect value={!snapshot?.opening && startConfiguration ? startConfiguration.difficulty : details.conversation.settings.difficulty} saving={details.saving} onChange={async difficulty => { if (!snapshot?.opening && startConfiguration && currentChatId) setStartDraft({ id: currentChatId, value: { ...startConfiguration, difficulty } }); else await details.saveDifficulty(difficulty) }} />} />
          <button type="button" className="chat-new" aria-label={tr("New conversation")} title={tr("New conversation")} disabled={creatingConversation || !currentChatId} onClick={() => void startNewConversation()}><ToolbarIcon name="plus" size={17} /><span>{tr("New")}</span></button>
          </div>
        </ConversationHeader>
        <SkillRewards chatId={currentChatId} active={active} />
        <div className="reward-effects-rail" data-reward-surface />
        <div className="stream" ref={streamRef} onScroll={onStreamScroll}>
          {readError && <div role="alert"><p>{tr("Conversation updates stopped.")} {readError}</p><button type="button" onClick={retryRead}>{tr("Retry reading conversation")}</button></div>}
          {snapshot?.hasOlder && <button type="button" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder ? tr("Loading older messages…") : tr("Load older messages")}</button>}
          {olderError && <p role="alert">{olderError}</p>}
          {turns.length === 0 && !error && !sending && connection?.configured === false ? (
            <div className="access-start">
              <p>{tr("Choose how to connect to AI.")}</p>
              <button type="button" className="btn primary" disabled={signingIn} onClick={() => void startHostedSignIn()}>
                {signingIn ? tr("Signing in…") : tr("Sign in with Google")}
              </button>
              <button type="button" className="access-alternative" onClick={onOpenSettings ?? (() => useNavigationStore.getState().showOverlay('settings'))}>
                {tr("Or set up AI access in another way")}
              </button>
            </div>
          ) : turns.length === 0 && !error && (
            snapshot && (snapshot.opening ? <OpeningStatus snapshot={snapshot} onActivity={() => useNavigationStore.getState().showOverlay('activity')} /> : startConfiguration && <ConversationStart conversationId={snapshot.conversationId} value={startConfiguration} onChange={value => setStartDraft({ id: snapshot.conversationId, value })} partnerSymbol={contactChoices.find(choice => choice.id === activeContactId)?.symbol} partnerName={details.persona ? personaName(details.persona.details) : undefined} key={snapshot.conversationId} topics={snapshot.topicChoices} busy={sending || pendingReply} onStart={startConversation} greeting={snapshot.starterGreeting} targetTag={targetLanguage?.languageTag ?? undefined} targetDir={rtl ? 'rtl' : 'ltr'} recording={mic.recording} transcribing={mic.transcribing} canPartnerStart={!input.trim() && !mic.recording && !mic.transcribing} onRecord={toggleMic} onSwitchPartner={() => setHistoryOpen(true)} onEditPersona={details.persona ? () => setEditingPersonaId(details.persona!.id) : undefined} />)
          )}
          {activeTurns.map((turn) => (
            <ConversationErrorScope key={turn.turnId} conversationId={snapshot?.conversationId} turn={turn.execution}><TurnView
              turn={turn}
              onActivity={() => useNavigationStore.getState().inspectAi({ conversationId: snapshot?.conversationId ?? null, turnId: turn.turnId ?? null, operationKind: null })}
              latest={turn === activeTurns.at(-1)}
              onReplyControl={turn.turnId ? async control => { await executeAction(await readWorkspace(), { kind: 'controlTurn', turnId: turn.turnId!, control }) } : undefined}
              onRetryGloss={async operationId => { await executeAction(await readWorkspace(), { kind: 'retryGloss', operationId }) }}
              reviewing={turn.analysisState === 'pending' || reviewing.has(turn.id)}
              onAskCoach={askCoach}
              focused={(pinnedId ?? latestAssistantId) === turn.id}
              ttsReady={isTauri && Boolean(turn.assistant?.messageId)}
              speaking={Boolean(turn.assistant?.messageId && speech.messageId === turn.assistant.messageId)}
              speechError={speech.failure?.messageId === turn.assistant?.messageId ? speech.failure ?? undefined : undefined}
              onSpeak={() => { if (turn.assistant?.messageId) speech.toggle(turn.assistant.messageId) }}
              rtl={rtl}
              onBubbleTap={onBubbleTap}
              onOpenCoach={openCoach}
              onRetryHelp={turn.turnId ? async () => { await executeAction(await readWorkspace(), {kind:'controlTurn', turnId:turn.turnId!, control:'retry'}) } : undefined}
              onCoachControl={snapshot && turn.turnId ? async (selected, control) => {
                if (!selected.turnId) throw new Error('Coaching source is unavailable.')
                await executeAction(snapshot, { kind: 'coachControl', turnId: selected.turnId, control, expectedRevision: snapshot.revision })
              } : undefined}
              editDisabled={acceptingSend.current || acceptedEditSource !== null}
              onEditUser={turn.turnId && turn.user !== null ? selected => {
                setEditingTurnId(selected.id)
                setEditRevision(snapshot?.revision ?? null)
                setInput(selected.user ?? '')
                setError(null)
                inputEvidence.current = unreportedInput()
                composer.current?.querySelector('textarea')?.focus()
              } : undefined}
            />
            </ConversationErrorScope>
          ))}
          {error && (
            <ErrorDetails label={tr("Request failed")} errorKey={error} explanation={error}>
              {/* A message that says "go to Settings" should take you there,
                  rather than making you find the gear yourself. */}
              {onOpenSettings && needsProviderSetup(error) && (
                <button type="button" className="err-action" onClick={onOpenSettings}>
                  {tr("Open Settings")}</button>
              )}
            </ErrorDetails>
          )}
        </div>

        {!isMobile && chatComposer}
      </section>

      {!isMobile && breakOpen && <PracticeDivider workspace={workspace} />}

      {isMobile && <div className="chat mobile-composer">{chatComposer}</div>}

      {/* ── Breakdown half (dark) — full panel in mobile Coach/Analysis mode ── */}
      <section
        className={`break ${breakOpen || isMobile ? '' : 'collapsed'}`}
        ref={breakRef}
      >
        {!breakOpen && !isMobile && <button type="button" className="break-head" onClick={toggleBreak} aria-expanded={false}>{tr("Coach")}</button>}

        {/* Private coaching and message assessment. */}
        {currentChatId && <CoachAnalysisPanel
          key={`${currentChatId}:${settings?.target_language}:${settings?.native_language}:${threadReload}`}
          coachingContent={<>{!isMobile && replyHelp}<LiveCoachReview onAsk={askCoach} turn={activeTurns.find(turn => turn.id === pinnedId) ?? activeTurns.at(-1)} visible={active && mode === 'practice' && panelTab === 'coaching' && (isMobile || breakOpen)} nativeLanguageName={nativeLanguageName} rtl={rtl} onControl={async control => {
            const latest = activeTurns.find(turn => turn.id === pinnedId) ?? activeTurns.at(-1)
            if (!snapshot || !latest?.turnId) throw new Error('Coaching is unavailable.')
            await executeAction(snapshot, { kind: 'coachControl', turnId: latest.turnId, control, expectedRevision: snapshot.revision })
          }} /></>}
          chatId={currentChatId}
          conversationBusy={sending || details.saving}
          onCollapse={!isMobile ? toggleBreak : undefined}
          tab={panelTab}
          onTab={setPanelTab}
          autoSendDraft
          draftQuestion={coachDraft}
          onDraftConsumed={consumeCoachDraft}
          pinnedTurn={pinnedTurn}
          nativeLanguageName={nativeLanguageName}
          showRomanization={showRomanization}
          rtl={rtl}
        />}

      </section>

    </div>

      {contactError && <ErrorDetails label={tr("Contact")} errorKey={contactError}>{contactError}</ErrorDetails>}
      {newPersonaOpen && settings && <NewPersonaDialog key="new-persona" language={settings.target_language} romanized={romanized} busy={creatingConversation}
        onCreate={createPersona} onClose={() => setNewPersonaOpen(false)} />}
      {editingPersona && <PersonaProfileDialog key={editingPersona.id} persona={editingPersona} language={targetLanguageLabel(editingPersona.languageId)} romanized={Boolean(languageFor(editingPersona.languageId)?.romanization)} onSave={details.savePersona} onNewPersona={() => { setEditingPersonaId(null); setNewPersonaOpen(true) }} onClose={() => setEditingPersonaId(null)} />}
      {inspectionOpen && mic.lastTranscription && <TranscriptionInspector key={mic.lastTranscription.inspection.recordingId} result={mic.lastTranscription} onClose={() => setInspectionOpen(false)} />}
      {revisionConfirmation && <DetailDialog title={tr("Revise earlier message")} onClose={() => setRevisionConfirmation(null)}>
        <p>{tr("This revision removes ")}{revisionConfirmation.exchangeCount} {tr(" later conversation turns. Your edited message replaces the original; private coach history is kept.")}</p>
        <div className="detail-actions">
          <button type="button" onClick={() => setRevisionConfirmation(null)}>{tr("Cancel")}</button>
          <button type="button" disabled={acceptingSend.current || acceptedEditSource !== null} onClick={() => void submitText(revisionConfirmation.text, revisionConfirmation.input, revisionConfirmation.revision)}>{tr("Revise and remove later turns")}</button>
        </div>
      </DetailDialog>}
      {exportOpen && currentChatId && <ConversationExport key={currentChatId} conversationId={currentChatId} onClose={() => setExportOpen(false)} />}
      {analysisOpen && <DetailDialog title={tr("Message analysis")} onClose={() => setAnalysisOpen(false)}>
        <h2>{tr("Message analysis")}</h2>
        {pinnedTurn ? <ConversationErrorScope conversationId={snapshot?.conversationId} turn={pinnedTurn.execution} onInspect={() => setAnalysisOpen(false)}><AnalysisContent key={pinnedTurn.turnId} conversationId={snapshot?.conversationId} onAsk={askCoach} turn={pinnedTurn} nativeLanguageName={nativeLanguageName} showRomanization={showRomanization} rtl={rtl} /></ConversationErrorScope> : <p>{tr("Select Analysis on a conversation reply to inspect that message.")}</p>}
      </DetailDialog>}

    </div>
    </PracticeContext></RewardPresentationProvider></ReadingPreferencesProvider></AskCoachContext></ConversationReadingProvider>
  )
}
