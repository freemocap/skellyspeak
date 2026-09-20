// Generated from Rust contracts. Run npm run contracts.
export type RecordingStarted = { recordingId: string, samplesPerSecond: number, };
export type Theme = "light" | "dark" | "system";
export type RewardEvent = { id: string, attemptId: string, constructId: string, kind: string, tier: number, xp: number, quote: string, support: string, difficulty: string, novelty: string, policyHash: string, atSecs: bigint, claimed: boolean, };
export type LearnerState = { learnerId: string, languageId: string, asOfSecs: number, configHash: string, constructRegistryHash: string, estimatorHash: string, estimatorVersion: number, calibration: string, choices: unknown, observations: unknown[], constructs: Array<ConstructState>, };
export type ConstructState = { constructId: string, varietyId: string, rating: number, uncertainty: number, lastSeen: number, halfLifeDays: number, n: number, independentN: number, effectiveN: number, recall: number, dueAt: number, due: boolean, insufficientEvidence: boolean, evidenceAttemptIds: Array<string>, };
export type ConnectionRoute = "hosted" | "openrouter" | "custom";
export type SurfacePalette = "cool" | "warm";
export type ControlDensity = "standard" | "compact";
export type LayoutSpacing = "roomy" | "balanced" | "tight" | "extra_tight";
export type SurfaceDepth = "flat" | "subtle" | "raised" | "recessed";
export type AppearancePreferences = { palette: SurfacePalette, controlDensity: ControlDensity, layoutSpacing: LayoutSpacing, depth: SurfaceDepth, glowEnabled: boolean, glowColor: string, glowStrength: number, };
export type AccessSettings = { credentialPreviews?: { [key in string]: string }, customUrlIsUnsavedDefault: boolean, revision: number, groqKeyConfigured: boolean, customKeyConfigured: boolean, custom: CustomEndpoint, };
export type ProviderCredentialCheck = { diagnostics?: unknown, provider: string, state: string, status: number | null, durationMs: number, };
export type AccessCheck = { providers: Array<ProviderCredentialCheck>, };
export type CustomEndpoint = { baseUrl: string, bearerAuth: boolean, };
export type HostedAccount = { email: string, name: string, usedUsd: number, limitUsd: number, remainingUsd: number, tokensToday: number, requestsToday: number, estimatedRequestsRemaining: number, estimatedTokensRemaining: number, customLimit: boolean, resets: string, };
export type UsageSummary = { id: string, label: string, conversations: number, learnerMessages: number, personaMessages: number, attempts: number, inputTokens: number, outputTokens: number, unknownUsage: number, };
export type ProfileSnapshot = { revision: number, global: UsageSummary, languages: Array<UsageSummary>, personas: Array<UsageSummary>, };
export type PersonaGenerationAttempt = { diagnostics?: unknown, id: string, attemptId: string, operationId: string, languageId: string, route: ConnectionRoute, requestedModel: string, profileRevision: number, state: string, createdAt: string, dispatchedAt: string | null, finishedAt: string | null, actualModel: string | null, providerId: string | null, inputTokens: number | null, outputTokens: number | null, error: string | null, };
export type PersonaGenerationUsage = { attempts: number, inputTokens: number, outputTokens: number, unknownUsage: number, };
export type PersonaGenerationActivity = { revision: number, attempts: Array<PersonaGenerationAttempt>, usage: PersonaGenerationUsage, };
export type AudioModelSettings = { model: string, };
export type AudioSettings = { transcription: AudioModelSettings, speech: AudioModelSettings, };
export type ConnectionConfig = { route: ConnectionRoute, signedIn: boolean, ownKeyConfigured: boolean, email: string, revision: number, configured: boolean, standardModel: string, fastModel: string, audio: AudioSettings, paused: boolean, };
export type TurnControl = "pause" | "resume" | "step" | "cancel" | "retry";
export type GlossSegmentKind = "gloss" | "literal" | "unresolved";
export type GlossCoverage = "complete" | "partial";
export type GlossSegment = { start: number, end: number, kind: GlossSegmentKind, gloss: string | null, romanization?: string, pronunciation?: string, };
export type WordGlossView = { sourceMessageId: string, targetLanguageId: string, explanationLanguageId: string, formatVersion: string, templateVersion: string, boundaryPolicy: string, operationId: string, attemptId: string, coverage: GlossCoverage, segments: Array<GlossSegment>, };
export type DiagnosticCommand = "begin_reading" | "run_reading" | "cancel_reading" | "get_reading_activity" | "share_diagnostic_logs" | "read_speech_audio" | "get_update_channel" | "latest_github_release" | "mic_start" | "mic_wave" | "mic_cancel" | "mic_transcribe" | "factory_reset" | "get_startup_state" | "begin_persona_generation" | "run_persona_generation" | "cancel_persona_generation" | "get_persona_generation_activity" | "get_snapshot" | "execute_command" | "get_access_settings" | "save_access_settings" | "check_access" | "get_connection" | "save_connection" | "save_models" | "verify_openrouter_key" | "disconnect" | "watch_conversation" | "hosted_sign_in" | "hosted_account" | "hosted_diagnostics" | "hosted_sign_out" | "cancel_sign_in" | "select_route" | "get_profile" | "get_reward_settings" | "get_playback_rate" | "save_playback_rate" | "save_reward_settings" | "get_skill_evidence" | "get_practice_overview" | "save_skill_profile" | "open_ai_window" | "list_turn_history" | "get_attempt_detail" | "read_attempt_streams" | "ai_window_state" | "dock_ai_window" | "set_ai_view_selection" | "get_ai_view_selection" | "get_ai_graph_definitions";
export type RewardSettings = { revision: number, fastMode: boolean, rewardSounds: string, masterVolume: number, voiceVolume: number, effectsVolume: number, };
export type InputEvidence = { modality: string, suggestion: boolean, scaffold: boolean, revision: boolean, };
export type Outcome = "demonstrated" | "partial" | "not_demonstrated" | "not_observed" | "uncertain";
export type RevisionSuffixCount = { turnId: string, exchangeCount: number, coachTurnCount: number, };
export type MeaningLevel = "full" | "partial" | "none";
export type ErrorOp = "missing" | "replace" | "unnecessary";
export type ErrorSource = "transfer" | "developmental" | "slip" | "unknown";
export type ErrorTag = { op: ErrorOp, category: string, source: ErrorSource, blocks_meaning: boolean, target_hypothesis: string, hint: string, elicitation: string, metalinguistic: string, };
export type ObservedItem = { construct: string, quote: string, outcome: Outcome, error: ErrorTag | null, rationale: string, };
export type CoachObservation = { meaning_recovered: MeaningLevel, items: Array<ObservedItem>, };
export type ObservedItemSummary = { construct: string, quote: string, outcome: Outcome, rationale: string, };
export type CoachObservationView = { meaningRecovered: MeaningLevel, items: Array<ObservedItemSummary>, candidatesSent: number, itemsReturned: number, };
export type CoachMove = "partner_clarify" | "hint" | "elicit" | "metalinguistic" | "explicit";
export type Correction = { construct: string, quote: string, move: CoachMove, text: string, explanation?: string, };
export type CoachDecision = { exposedMove: CoachMove | null, repairStatus: RepairStatus | null, shown: Correction | null, retryInvited: boolean, fixed: string | null, alsoNoticed: Array<ObservedItemSummary>, keptGoing: boolean, };
export type CoachControl = "open_card" | "show_answer" | "keep_going";
export type RetryCheck = { repaired: boolean, meaning_recovered: MeaningLevel, items: Array<ObservedItem>, };
export type PartnerReaction = { kind: ReactionKind, interpretation: string, explanation: string, };
export type ReactionKind = "happy" | "sad" | "angry" | "understood" | "confused" | "curious" | "surprised" | "concerned";
export type RepairStatus = "repaired" | "not_repaired" | "uncertain";
export type Opening = { "kind": "learner" } | { "kind": "partner" };
export type TopicCard = { id: string, 
/**
 * Decorative; the labels carry the meaning.
 */
glyph: string, 
/**
 * The scene name in the conversation's target language.
 */
target: string, 
/**
 * The target name transliterated, when the conversation's variety resolves
 * to a romanization scheme. `None` for Latin-script languages.
 */
romanized: string | null, 
/**
 * The same scene name in the conversation's explanation language. Equal to
 * `target` when the two languages match; the surface decides whether to
 * draw it twice.
 */
translation: string, };
export type SavedTopic = { id: string, text: string, };
export type TimeReference = "any" | "past" | "future";
export type TopicChoice = { "kind": "builtin", id: string, } | { "kind": "custom", text: string, };
export type ConversationDirection = { topic: TopicChoice | null, timeReference: TimeReference, usePersonaDetails: boolean, };
export type ConversationStartConfig = { difficulty: Difficulty, varietyId: string, direction: ConversationDirection, };
export type PromptPreview = { configuration: ConversationStartConfig, yaml: string, systemPrompt: string, difficultyPrompts: Array<[Difficulty, string]>, };
export type SuggestedReply = { text: string, segments: Array<GlossSegment>, };
export type ConversationFeedback = { remark: string, usedTarget: Array<string>, usedNative: Array<string>, corrections: Array<ConversationCorrection>, grammar: number, conversation: number, };
export type ConversationCorrection = { said: string, corrected: string, explanation: string, kind: string, };
export type AssistedReply = { text: string, translation: string, romanization: string, pronunciation: string, };
export type ReplyAssistance = { explanation: string, replies: Array<AssistedReply>, frames: Array<string>, starters: Array<string>, };
export type ReplyExplanation = { quote: string, title: string, body: string, example: string, contrast: string, };
export type ReplyExplanations = { cards: Array<ReplyExplanation>, };
export type ChatMessage = { conversationFeedback?: ConversationFeedback, replyAssistance?: ReplyAssistance, replyExplanations?: ReplyExplanations, explanationsState?: string, explanationsError?: string, reaction?: PartnerReaction, reactionError?: string, coachDecision: CoachDecision | null, turnId: string, replacesTurnId: string | null, replacedBy: string | null, feedback?: CoachObservationView, feedbackState?: string, feedbackError?: string, suggestedReplies?: Array<SuggestedReply>, suggestionsState?: string, suggestionsError?: string, wordGloss: WordGlossView | null, glossState: string | null, glossError: string | null, glossOperationId: string | null, translationState: string | null, translation: string | null, id: string, sequence: number, role: string, text: string, createdAt: string, };
export type OperationView = { sourceMessageId: string | null, id: string, kind: string, contractVersion: number, dependencies: Array<string>, role: string, state: string, };
export type AttemptView = { diagnostics?: unknown, id: string, operationId: string, state: string, requestedModel: string, actualModel: string | null, providerId: string | null, startedAt: string, finishedAt: string | null, inputTokens: number | null, outputTokens: number | null, error: string | null, 
/**
 * Text a prose reply received but did not publish as a message.
 */
unpublishedText: string | null, };
export type TurnView = { replacesTurnId: string | null, replacedBy: string | null, route: ConnectionRoute, id: string, state: string, paused: boolean, hold: AppError | null, operations: Array<OperationView>, attempts: Array<AttemptView>, };
export type TurnHistoryPage = { turns: Array<TurnView>, hasOlder: boolean, };
export type RecordedMessage = { role: string, content: string, };
export type AttemptDetail = { requestMessages: Array<RecordedMessage> | null, responseText: string | null, previewText: string | null, };
export type AttemptStreamUpdate = { generation: number, attemptId: string, conversationId: string, turnId: string, operationId: string, kind: string, seq: number, text: string, terminal: string | null, };
export type AttemptStreamRead = { generation: number, entries: Array<AttemptStreamUpdate>, };
export type AiViewSelection = { conversationId: string | null, turnId: string | null, operationKind: string | null, definition?: AiDefinitionSelection, };
export type AiDefinitionSelection = { graphId: string, operationKind: string | null, };
export type AiGraphDefinition = { id: string, description: string, operations: Array<AiOperationDefinition>, };
export type AiOperationDefinition = { kind: string, dependencies: Array<string>, role: string, contractVersion: number | null, description: string, source: string, templates: Array<AiPromptTemplate>, outputSchema: unknown, };
export type AiPromptTemplate = { label: string, text: string, };
export type AiWindowState = { supported: boolean, open: boolean, };
export type ConversationSnapshot = { topicChoices: Array<TopicCard>, 
/**
 * The greeting the start surface offers as a first thing to say, resolved
 * for this conversation's target language and variety.
 */
starterGreeting: StarterGreeting, opening: Opening | null, revisionSuffixCounts: Array<RevisionSuffixCount>, transcriptionAttempts: Array<TranscriptionAttempt>, holds: Array<InferenceHold>, coachMessages: Array<ChatMessage>, conversationId: string, sessionId: string, revision: number, messages: Array<ChatMessage>, turns: Array<TurnView>, connection: ConnectionConfig, hasOlder: boolean, };
export type Difficulty = "absolute_zero" | "beginner" | "intermediate" | "advanced" | "fluent";
export type HelpAmount = "minimal" | "balanced" | "generous";
export type CoachProactivity = "on_request" | "occasional" | "frequent";
export type PracticeSettings = { difficulty: Difficulty, direction: ConversationDirection, explanationLanguage: string, varietyId: string, explanationVarietyId: string, composingHelp: HelpAmount, coachProactivity: CoachProactivity, translation: boolean, pronunciation: boolean, romanization: boolean, autoSend: boolean, readAloud: boolean, speechVoice: string, };
export type SpeechUnavailableReason = "notRequested" | "cancelled" | "failed" | "unknownOutcome" | "expired";
export type SpeechAudioState = { "status": "pending", operationId: string, messageId: string, } | { "status": "ready", operationId: string, attemptId: string, messageId: string, mime: string, audioBase64: string, } | { "status": "unavailable", operationId: string, messageId: string, reason: SpeechUnavailableReason, };
export type OnboardingStatus = "not_started" | "in_progress" | "skipped" | "completed";
export type Preferences = { theme: Theme, appearance: AppearancePreferences, explanationLanguage: string, explanationVarietyId: string, interfaceLocale: string, targetVarieties: { [key in string]: string }, scriptScales?: { [key in string]: number }, myLanguages: Array<string>, textSize: number, textSpacing: number, highContrast: boolean, onboarding: OnboardingStatus, onboardingRequired: boolean, onboardingLanguage: string | null, onboardingHelp: boolean, };
export type Learner = { id: string, name: string, revision: number, preferences: Preferences, };
export type LanguageProfile = { id: string, learnerId: string, languageId: string, };
export type PersonaDetails = { name: string, 
/**
 * The name in Latin letters, present exactly when the persona's language has
 * a romanization system.
 */
romanizedName: string | null, 
/**
 * Left blank until someone chooses one.
 */
age: number | null, location: string, occupation: string, background: string, currentSituation: string, interests: Array<string>, opinions: Array<string>, interestingFacts: Array<string>, favoriteBooks: Array<string>, favoriteMovies: Array<string>, manner: string, quirks: Array<string>, vibe: Array<string>, };
export type Persona = { id: string, learnerId: string, languageId: string, revision: number, details: PersonaDetails, };
export type Contact = { id: string, learnerId: string, personaId: string, archived: boolean, revision: number, };
export type Conversation = { id: string, contactId: string, languageId: string, title: string, archived: boolean, revision: number, settingsRevision: number, settings: PracticeSettings, createdAt: string, lastUsed: number, };
export type Variety = { transcriptionLanguage: string | null, direction: string, fontScale: number, romanization: string | null, id: string, name: string, description: string, };
export type Language = { transcriptionLanguage: string | null, languageTag: string | null, fontScale: number, direction: string, romanization: string | null, id: string, name: string, nativeName: string, varieties: Array<Variety>, defaultVariety: string, 
/**
 * The authored greeting, at this language's default variety. Carried on the
 * catalog so choosing a language can show what saying it sounds like.
 */
greeting: StarterGreeting, 
/**
 * Who the learner meets first in this language. Enough of the bundled
 * starter persona to introduce them, not the whole profile.
 */
partner: LanguagePartner, };
export type LanguageInspection = { fingerprint: string, language: Language, varietyId: string, review: string, family: string, values: Array<ContentValue>, rules: Array<ContentRule>, schemes: Array<SchemeInspection>, sources: Array<ContentSource>, partner: PersonaDetails, schemaJson: string, resolvedJson: string, learningJson: string, conversationJson: string, };
export type ContentSource = { path: string, yaml: string, };
export type ContentRule = { scope: string, text: string, source: string, };
export type ContentValue = { field: string, value: string, source: string, };
export type SchemeInspection = { id: string, label: string, instructions: string, examples: Array<[string, string]>, sources: Array<string>, review: string, source: string, selected: boolean, usedBy: Array<string>, };
export type Snapshot = { sessionId: string, revision: number, learner: Learner, languages: Array<Language>, languageProfiles: Array<LanguageProfile>, personas: Array<Persona>, contacts: Array<Contact>, conversations: Array<Conversation>, savedTopics: Array<SavedTopic>, };
export type StartupState = { 
/**
 * Set when the workspace could not be opened, so the shell cannot mount.
 */
refusal: AppError | null, 
/**
 * Set when directories a previous reset recorded still could not be cleared.
 * The app is usable; that leftover data is not cleared.
 */
cleanup: AppError | null, credentialCleanup: AppError | null, };
export type Action = { "kind": "startConversation", conversationId: string, configuration: ConversationStartConfig, message: string | null, input: InputEvidence | null, expectedRevision: number, } | { "kind": "updateConversationPrompt", conversationId: string, configuration: ConversationStartConfig, additions: Array<string>, deletions: Array<string>, expectedRevision: number, expectedSettingsRevision: number, } | { "kind": "saveTopics", additions: Array<string>, deletions: Array<string>, expectedRevision: number, } | { "kind": "coachControl", turnId: string, control: CoachControl, expectedRevision: number, } | { "kind": "reviseTurn", conversationId: string, turnId: string, text: string, input: InputEvidence, expectedRevision: number, } | { "kind": "askCoach", conversationId: string, text: string, expectedRevision: number, } | { "kind": "startChat", languageId: string, } | { "kind": "sendMessage", input: InputEvidence, conversationId: string, text: string, expectedRevision: number, } | { "kind": "requestMessageSpeech", messageId: string, } | { "kind": "cancelMessageSpeech", operationId: string, } | { "kind": "requestSuggestions", messageId: string, } | { "kind": "retryGloss", operationId: string, } | { "kind": "controlTurn", turnId: string, control: TurnControl, } | { "kind": "setPaused", paused: boolean, } | { "kind": "recoverAiAccess", holdId: string, expectedGeneration: string, } | { "kind": "createContact", languageId: string, details: PersonaDetails, } | { "kind": "updatePersona", personaId: string, expectedRevision: number, details: PersonaDetails, } | { "kind": "setContactArchived", contactId: string, expectedRevision: number, archived: boolean, } | { "kind": "deleteContact", contactId: string, expectedRevision: number, } | { "kind": "createConversation", contactId: string, title: string, } | { "kind": "openConversation", conversationId: string, } | { "kind": "updateConversation", conversationId: string, expectedRevision: number, title: string, archived: boolean, } | { "kind": "updateSettings", conversationId: string, expectedRevision: number, settings: PracticeSettings, } | { "kind": "deleteConversation", conversationId: string, expectedRevision: number, } | { "kind": "updateLearner", expectedRevision: number, name: string, preferences: Preferences, };
export type Command = { sessionId: string, actionId: string, action: Action, };
export type Receipt = { actionId: string, entityId: string, revision: number, };
export type ErrorCode = "validation" | "conflict" | "not_found" | "session_expired" | "storage" | "provider" | "admission_held" | "pending_turn" | "config_load" | "unknown_outcome" | "credential" | "internal";
export type Refusal = { reason: RefusalReason, serviceWide: boolean, retryAt: number | null, requestId: string | null, };
export type InferenceHold = { id: string, generation: string, route: ConnectionRoute, error: AppError, };
export type StarterGreeting = { text: string, romanized: string | null, };
export type LanguagePartner = { name: string, romanizedName: string | null, vibe: Array<string>, };
export type TranscriptionAttempt = { diagnostics?: unknown, id: string, route: ConnectionRoute, model: string, state: string, startedAt: string, finishedAt: string | null, error: string | null, };
export type Segment = { id: number, start: number, end: number, text: string, avg_logprob: number, no_speech_prob: number, seek: number | null, tokens: Array<number> | null, temperature: number | null, compression_ratio: number | null, };
export type TranscriptionInspectionResult = { text: string, inspection: AudioInspection, audioBase64: string, segments: Array<Segment>, };
export type AudioInspection = { recordingId: string, conversationId: string, duration: number, sampleRate: number, waveform: InspectionWaveform, spectrogram: InspectionSpectrogram, activity: InspectionActivity, wordTiming: InspectionWordTiming, };
export type InspectionWaveform = { binSeconds: number, min: Array<number>, max: Array<number>, };
export type InspectionSpectrogram = { frameSeconds: number, frameStartSeconds: Array<number>, windowSeconds: number, fftSize: number, frequencyBinHz: number, maxFrequencyHz: number, dbMin: number, dbMax: number, bins: Array<Array<number>>, };
export type InspectionActivity = { algorithm: string, noiseFloorDbfs: number, thresholdDbfs: number, regions: Array<InspectionRegion>, pauses: Array<InspectionPause>, limitations: Array<string>, };
export type InspectionRegion = { start: number, end: number, };
export type InspectionPause = { start: number, duration: number, };
export type InspectionWordTiming = { status: InspectionTimingStatus, reason: string | null, words: Array<InspectionWord>, unsupported: Array<InspectionUnsupportedWord>, };
export type InspectionWord = { index: number, word: string, providerStart: number, providerEnd: number, start: number, end: number, clipped: boolean, };
export type InspectionUnsupportedWord = { index: number, word: string, providerStart: number, providerEnd: number, reason: string, };
export type InspectionTimingStatus = "available" | "unavailable";
export type RefusalReason = "rate_limit" | "daily_limit" | "spending_paused" | "unknown";
export type ReadingInput = { text: string, language: string, variety: string | null, explanation: string, explanationVariety: string | null, speech: boolean, };
export type ReadingResult = { gloss: WordGlossView | null, audioBase64: string | null, receipt: unknown, };
export type AppError = { diagnostics?: unknown, code: ErrorCode, message: string, refusal: Refusal | null, };
export const PERSONA_LIMITS = { nameMax: 80, ageMin: 18, ageMax: 100, locationMax: 120, occupationMax: 120, backgroundMax: 2000, currentSituationMax: 600, mannerMax: 600, itemMax: 120, interestsMax: 12, opinionsMax: 12, factsMax: 12, booksMax: 8, moviesMax: 8, quirksMax: 8, vibeMin: 2, vibeMax: 4, briefMax: 200 } as const
export const SKILL_CATALOG_VERSION = 2224765241 as const
export const TEXT_SIZE = { default: 85, min: 75, max: 160, step: 5 } as const
export const DEFAULT_APPEARANCE: AppearancePreferences = {"palette":"cool","controlDensity":"standard","layoutSpacing":"tight","depth":"subtle","glowEnabled":false,"glowColor":"#7c5cff","glowStrength":30}
