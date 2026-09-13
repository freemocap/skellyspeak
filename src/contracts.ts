// Generated from Rust contracts. Run npm run contracts.
export type RecordingStarted = { recordingId: string, samplesPerSecond: number, };
export type ConnectionRoute = "hosted" | "openrouter" | "custom";
export type AccessSettings = { customUrlIsUnsavedDefault: boolean, revision: number, groqKeyConfigured: boolean, customKeyConfigured: boolean, custom: CustomEndpoint, };
export type CustomEndpoint = { baseUrl: string, standardModel: string, fastModel: string, bearerAuth: boolean, transcriptionModel: string | null, };
export type HostedAccount = { email: string, name: string, usedUsd: number, limitUsd: number, remainingUsd: number, tokensToday: number, requestsToday: number, estimatedRequestsRemaining: number, estimatedTokensRemaining: number, customLimit: boolean, resets: string, };
export type UsageSummary = { id: string, label: string, conversations: number, learnerMessages: number, personaMessages: number, attempts: number, inputTokens: number, outputTokens: number, unknownUsage: number, };
export type ProfileSnapshot = { revision: number, global: UsageSummary, languages: Array<UsageSummary>, personas: Array<UsageSummary>, };
export type PersonaGenerationAttempt = { id: string, attemptId: string, operationId: string, languageId: string, route: ConnectionRoute, requestedModel: string, profileRevision: number, state: string, createdAt: string, dispatchedAt: string | null, finishedAt: string | null, actualModel: string | null, providerId: string | null, inputTokens: number | null, outputTokens: number | null, error: string | null, };
export type PersonaGenerationUsage = { attempts: number, inputTokens: number, outputTokens: number, unknownUsage: number, };
export type PersonaGenerationActivity = { revision: number, attempts: Array<PersonaGenerationAttempt>, usage: PersonaGenerationUsage, };
export type ConnectionConfig = { route: ConnectionRoute, signedIn: boolean, ownKeyConfigured: boolean, email: string, revision: number, configured: boolean, standardModel: string, fastModel: string, paused: boolean, };
export type TurnControl = "pause" | "resume" | "step" | "cancel" | "retry";
export type GlossSegmentKind = "gloss" | "literal" | "unresolved";
export type GlossCoverage = "complete" | "partial";
export type GlossSegment = { start: number, end: number, kind: GlossSegmentKind, gloss: string | null, romanization?: string, pronunciation?: string, };
export type WordGlossView = { sourceMessageId: string, targetLanguageId: string, explanationLanguageId: string, formatVersion: string, templateVersion: string, boundaryPolicy: string, operationId: string, attemptId: string, coverage: GlossCoverage, segments: Array<GlossSegment>, };
export type DiagnosticCommand = "read_speech_audio" | "get_update_channel" | "latest_github_release" | "mic_start" | "mic_wave" | "mic_cancel" | "mic_transcribe" | "factory_reset" | "get_startup_state" | "begin_persona_generation" | "run_persona_generation" | "cancel_persona_generation" | "get_persona_generation_activity" | "get_snapshot" | "execute_command" | "get_access_settings" | "save_access_settings" | "check_access" | "get_connection" | "save_connection" | "verify_openrouter_key" | "disconnect" | "watch_conversation" | "hosted_sign_in" | "hosted_account" | "hosted_diagnostics" | "hosted_sign_out" | "cancel_sign_in" | "select_route" | "get_profile" | "get_reward_settings" | "get_playback_rate" | "save_playback_rate" | "save_reward_settings" | "get_skill_evidence" | "get_practice_overview" | "save_skill_profile" | "open_ai_window";
export type RewardSettings = { revision: number, fastMode: boolean, rewardSounds: string, masterVolume: number, voiceVolume: number, effectsVolume: number, };
export type InputEvidence = { modality: string, suggestion: boolean, scaffold: boolean, revision: boolean, };
export type Evidence = { skill_id: string, quote: string, outcome: Outcome, rationale: string, };
export type Outcome = "demonstrated" | "partial" | "not_demonstrated" | "not_observed" | "uncertain";
export type RevisionSuffixCount = { turnId: string, exchangeCount: number, coachTurnCount: number, };
export type Feedback = { correctness: number | null, understandability: number | null, explanation: string, correction: string, evidence: Array<Evidence>, };
export type SuggestedReply = { text: string, segments: Array<GlossSegment>, };
export type ChatMessage = { turnId: string, replacesTurnId: string | null, replacedBy: string | null, feedback?: Feedback, feedbackState?: string, feedbackError?: string, suggestedReplies?: Array<SuggestedReply>, suggestionsState?: string, suggestionsError?: string, wordGloss: WordGlossView | null, glossState: string | null, glossError: string | null, glossOperationId: string | null, translationState: string | null, translation: string | null, id: string, sequence: number, role: string, text: string, createdAt: string, };
export type OperationView = { sourceMessageId: string | null, id: string, kind: string, contractVersion: number, dependencies: Array<string>, role: string, state: string, };
export type AttemptView = { id: string, operationId: string, state: string, requestedModel: string, actualModel: string | null, providerId: string | null, startedAt: string, finishedAt: string | null, inputTokens: number | null, outputTokens: number | null, error: string | null, };
export type TurnView = { replacesTurnId: string | null, replacedBy: string | null, route: ConnectionRoute, id: string, state: string, paused: boolean, hold: AppError | null, operations: Array<OperationView>, attempts: Array<AttemptView>, };
export type ConversationSnapshot = { revisionSuffixCounts: Array<RevisionSuffixCount>, transcriptionAttempts: Array<TranscriptionAttempt>, holds: Array<InferenceHold>, coachMessages: Array<ChatMessage>, conversationId: string, sessionId: string, revision: number, messages: Array<ChatMessage>, turns: Array<TurnView>, connection: ConnectionConfig, hasOlder: boolean, };
export type Difficulty = "absolute_zero" | "beginner" | "intermediate" | "advanced" | "fluent";
export type HelpAmount = "minimal" | "balanced" | "generous";
export type CoachProactivity = "on_request" | "occasional" | "frequent";
export type PracticeSettings = { difficulty: Difficulty, explanationLanguage: string, varietyId: string, composingHelp: HelpAmount, coachProactivity: CoachProactivity, translation: boolean, pronunciation: boolean, romanization: boolean, autoSend: boolean, readAloud: boolean, speechVoice: string, };
export type SpeechUnavailableReason = "notRequested" | "cancelled" | "failed" | "unknownOutcome" | "expired";
export type SpeechAudioState = { "status": "pending", operationId: string, messageId: string, } | { "status": "ready", operationId: string, attemptId: string, messageId: string, mime: string, audioBase64: string, } | { "status": "unavailable", operationId: string, messageId: string, reason: SpeechUnavailableReason, };
export type OnboardingStatus = "not_started" | "in_progress" | "skipped" | "completed";
export type Preferences = { explanationLanguage: string, textSize: number, textSpacing: number, highContrast: boolean, onboarding: OnboardingStatus, };
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
export type Variety = { id: string, name: string, };
export type Language = { fontScale: number, direction: string, romanization: string | null, id: string, name: string, nativeName: string, varieties: Array<Variety>, };
export type Snapshot = { sessionId: string, revision: number, learner: Learner, languages: Array<Language>, languageProfiles: Array<LanguageProfile>, personas: Array<Persona>, contacts: Array<Contact>, conversations: Array<Conversation>, };
export type StartupState = { 
/**
 * Set when the workspace could not be opened, so the shell cannot mount.
 */
refusal: AppError | null, 
/**
 * Set when directories a previous reset recorded still could not be cleared.
 * The app is usable; that leftover data is not cleared.
 */
cleanup: AppError | null, };
export type Action = { "kind": "reviseTurn", conversationId: string, turnId: string, text: string, input: InputEvidence, expectedRevision: number, } | { "kind": "askCoach", conversationId: string, text: string, expectedRevision: number, } | { "kind": "startChat", languageId: string, } | { "kind": "sendMessage", input: InputEvidence, conversationId: string, text: string, expectedRevision: number, } | { "kind": "requestMessageSpeech", messageId: string, } | { "kind": "cancelMessageSpeech", operationId: string, } | { "kind": "retryGloss", operationId: string, } | { "kind": "controlTurn", turnId: string, control: TurnControl, } | { "kind": "setPaused", paused: boolean, } | { "kind": "recoverAiAccess", holdId: string, expectedGeneration: string, } | { "kind": "createContact", languageId: string, details: PersonaDetails, } | { "kind": "updatePersona", personaId: string, expectedRevision: number, details: PersonaDetails, } | { "kind": "setContactArchived", contactId: string, expectedRevision: number, archived: boolean, } | { "kind": "deleteContact", contactId: string, expectedRevision: number, } | { "kind": "createConversation", contactId: string, title: string, } | { "kind": "openConversation", conversationId: string, } | { "kind": "updateConversation", conversationId: string, expectedRevision: number, title: string, archived: boolean, } | { "kind": "updateSettings", conversationId: string, expectedRevision: number, settings: PracticeSettings, } | { "kind": "deleteConversation", conversationId: string, expectedRevision: number, } | { "kind": "updateLearner", expectedRevision: number, name: string, preferences: Preferences, };
export type Command = { sessionId: string, actionId: string, action: Action, };
export type Receipt = { actionId: string, entityId: string, revision: number, };
export type ErrorCode = "validation" | "conflict" | "not_found" | "session_expired" | "storage" | "provider" | "admission_held" | "pending_turn" | "unknown_outcome" | "credential" | "internal";
export type Refusal = { reason: RefusalReason, serviceWide: boolean, retryAt: number | null, requestId: string | null, };
export type InferenceHold = { id: string, generation: string, route: ConnectionRoute, error: AppError, };
export type TranscriptionAttempt = { id: string, route: ConnectionRoute, model: string, state: string, startedAt: string, finishedAt: string | null, error: string | null, };
export type RefusalReason = "rate_limit" | "daily_limit" | "spending_paused" | "unknown";
export type AppError = { code: ErrorCode, message: string, refusal: Refusal | null, };
export const PERSONA_LIMITS = { nameMax: 80, ageMin: 18, ageMax: 100, locationMax: 120, occupationMax: 120, backgroundMax: 2000, currentSituationMax: 600, mannerMax: 600, itemMax: 120, interestsMax: 12, opinionsMax: 12, factsMax: 12, booksMax: 8, moviesMax: 8, quirksMax: 8, vibeMin: 2, vibeMax: 4, briefMax: 200 } as const
export const SKILL_CATALOG_VERSION = 2742549041 as const
export const TEXT_SIZE = { default: 85, min: 75, max: 150, step: 5 } as const
