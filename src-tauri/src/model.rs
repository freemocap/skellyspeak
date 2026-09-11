use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AvatarRecipe {
    pub seed: u32,
    pub hue: u16,
    pub lobes: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Difficulty {
    Gentle,
    Balanced,
    Challenging,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum HelpAmount {
    Minimal,
    Balanced,
    Generous,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CoachProactivity {
    OnRequest,
    Occasional,
    Frequent,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PracticeSettings {
    pub difficulty: Difficulty,
    pub explanation_language: String,
    pub variety_id: String,
    pub composing_help: HelpAmount,
    pub coach_proactivity: CoachProactivity,
    pub translation: bool,
    pub pronunciation: bool,
    pub romanization: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OnboardingStatus {
    NotStarted,
    InProgress,
    Skipped,
    Completed,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Preferences {
    pub explanation_language: String,
    pub text_size: u16,
    pub text_spacing: u8,
    pub high_contrast: bool,
    pub onboarding: OnboardingStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Learner {
    pub id: String,
    pub name: String,
    pub revision: i32,
    pub preferences: Preferences,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct LanguageProfile {
    pub id: String,
    pub learner_id: String,
    pub language_id: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PartnerDetails {
    pub name: String,
    pub background: String,
    pub tendencies: String,
    pub vibe: Vec<String>,
    pub avatar: AvatarRecipe,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Partner {
    pub id: String,
    pub learner_id: String,
    pub language_id: String,
    pub revision: i32,
    pub details: PartnerDetails,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Relationship {
    pub id: String,
    pub learner_id: String,
    pub partner_id: String,
    pub archived: bool,
    pub revision: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    pub id: String,
    pub relationship_id: String,
    pub language_id: String,
    pub title: String,
    pub archived: bool,
    pub revision: i32,
    pub settings_revision: i32,
    pub settings: PracticeSettings,
    pub created_at: String,
    pub last_used: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Variety {
    pub id: String,
    pub name: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Language {
    pub direction: String,
    pub romanization: Option<String>,
    pub id: String,
    pub name: String,
    pub native_name: String,
    pub varieties: Vec<Variety>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub session_id: String,
    pub revision: i32,
    pub learner: Learner,
    pub languages: Vec<Language>,
    pub language_profiles: Vec<LanguageProfile>,
    pub partners: Vec<Partner>,
    pub relationships: Vec<Relationship>,
    pub conversations: Vec<Conversation>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum Action {
    AskCoach {
        conversation_id: String,
        text: String,
        expected_revision: i32,
    },
    StartChat {
        language_id: String,
    },
    SendMessage {
        conversation_id: String,
        text: String,
        expected_revision: i32,
    },
    ControlTurn {
        turn_id: String,
        control: TurnControl,
    },
    SetPaused {
        paused: bool,
    },
    RecoverAiAccess {
        hold_id: String,
        expected_generation: String,
    },
    CreatePartner {
        language_id: String,
    },
    UpdatePartner {
        partner_id: String,
        expected_revision: i32,
        details: PartnerDetails,
    },
    SetRelationshipArchived {
        relationship_id: String,
        expected_revision: i32,
        archived: bool,
    },
    DeletePartner {
        partner_id: String,
        expected_revision: i32,
    },
    CreateConversation {
        relationship_id: String,
        title: String,
    },
    OpenConversation {
        conversation_id: String,
    },
    UpdateConversation {
        conversation_id: String,
        expected_revision: i32,
        title: String,
        archived: bool,
    },
    UpdateSettings {
        conversation_id: String,
        expected_revision: i32,
        settings: PracticeSettings,
    },
    DeleteConversation {
        conversation_id: String,
        expected_revision: i32,
    },
    UpdateLearner {
        expected_revision: i32,
        name: String,
        preferences: Preferences,
    },
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Command {
    pub session_id: String,
    pub action_id: String,
    pub action: Action,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    pub action_id: String,
    pub entity_id: String,
    pub revision: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    Validation,
    Conflict,
    NotFound,
    SessionExpired,
    Storage,
    Provider,
    AdmissionHeld,
    UnknownOutcome,
    Credential,
    Internal,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(default)]
    pub refusal: Option<Refusal>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Refusal {
    pub reason: RefusalReason,
    pub service_wide: bool,
    pub retry_at: Option<f64>,
    pub request_id: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct InferenceHold {
    pub id: String,
    pub generation: String,
    pub route: ConnectionRoute,
    pub error: AppError,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum RefusalReason {
    RateLimit,
    DailyLimit,
    SpendingPaused,
    Unknown,
}
impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            refusal: None,
        }
    }
    pub fn with_refusal(mut self, refusal: Refusal) -> Self {
        self.refusal = Some(refusal);
        self
    }
}
impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.code, self.message)
    }
}
impl std::error::Error for AppError {}
impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::new(ErrorCode::Storage, error.to_string())
    }
}
impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::new(ErrorCode::Storage, error.to_string())
    }
}
pub type Result<T> = std::result::Result<T, AppError>;

pub fn bindings() -> String {
    let config = ts_rs::Config::default();
    let declarations = [
        ConnectionRoute::decl(&config),
        AccessSettings::decl(&config),
        CustomEndpoint::decl(&config),
        HostedAccount::decl(&config),
        UsageSummary::decl(&config),
        ProfileSnapshot::decl(&config),
        ConnectionConfig::decl(&config),
        TurnControl::decl(&config),
        ChatMessage::decl(&config),
        OperationView::decl(&config),
        AttemptView::decl(&config),
        TurnView::decl(&config),
        ConversationSnapshot::decl(&config),
        AvatarRecipe::decl(&config),
        Difficulty::decl(&config),
        HelpAmount::decl(&config),
        CoachProactivity::decl(&config),
        PracticeSettings::decl(&config),
        OnboardingStatus::decl(&config),
        Preferences::decl(&config),
        Learner::decl(&config),
        LanguageProfile::decl(&config),
        PartnerDetails::decl(&config),
        Partner::decl(&config),
        Relationship::decl(&config),
        Conversation::decl(&config),
        Variety::decl(&config),
        Language::decl(&config),
        Snapshot::decl(&config),
        Action::decl(&config),
        Command::decl(&config),
        Receipt::decl(&config),
        ErrorCode::decl(&config),
        Refusal::decl(&config),
        InferenceHold::decl(&config),
        TranscriptionAttempt::decl(&config),
        RefusalReason::decl(&config),
        AppError::decl(&config),
    ];
    format!(
        "// Generated from Rust contracts. Run npm run contracts.\n{}\n",
        declarations.map(|line| format!("export {line}")).join("\n")
    )
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub route: ConnectionRoute,
    pub signed_in: bool,
    pub own_key_configured: bool,
    pub email: String,
    pub revision: i32,
    pub configured: bool,
    pub standard_model: String,
    pub fast_model: String,
    pub paused: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum TurnControl {
    Pause,
    Resume,
    Step,
    Cancel,
    Retry,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub translation_state: Option<String>,
    pub translation: Option<String>,
    pub id: String,
    pub sequence: i32,
    pub role: String,
    pub text: String,
    pub created_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct OperationView {
    pub id: String,
    pub kind: String,
    pub contract_version: i32,
    pub dependencies: Vec<String>,
    pub role: String,
    pub state: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AttemptView {
    pub id: String,
    pub operation_id: String,
    pub state: String,
    pub requested_model: String,
    pub actual_model: Option<String>,
    pub provider_id: Option<String>,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub error: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TurnView {
    pub route: ConnectionRoute,
    pub id: String,
    pub state: String,
    pub paused: bool,
    pub hold: Option<AppError>,
    pub operations: Vec<OperationView>,
    pub attempts: Vec<AttemptView>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSnapshot {
    pub transcription_attempts: Vec<TranscriptionAttempt>,
    pub holds: Vec<InferenceHold>,
    pub coach_messages: Vec<ChatMessage>,
    pub conversation_id: String,
    pub session_id: String,
    pub revision: i32,
    pub messages: Vec<ChatMessage>,
    pub turns: Vec<TurnView>,
    pub connection: ConnectionConfig,
    pub has_older: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionAttempt {
    pub id: String,
    pub route: ConnectionRoute,
    pub model: String,
    pub state: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionRoute {
    Hosted,
    Openrouter,
    Custom,
}
impl ConnectionRoute {
    pub fn label(self) -> &'static str {
        match self {
            Self::Hosted => "hosted",
            Self::Openrouter => "openrouter",
            Self::Custom => "custom",
        }
    }
    pub fn parse(value: &str) -> Result<Self> {
        match value {
            "hosted" => Ok(Self::Hosted),
            "openrouter" => Ok(Self::Openrouter),
            "custom" => Ok(Self::Custom),
            _ => Err(AppError::new(ErrorCode::Storage, "Unknown AI route.")),
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
#[ts(rename_all = "camelCase")]
pub struct HostedAccount {
    pub email: String,
    pub name: String,
    pub used_usd: f64,
    pub limit_usd: f64,
    pub remaining_usd: f64,
    pub tokens_today: u32,
    pub requests_today: u32,
    #[serde(rename(
        deserialize = "estimated_turns_remaining",
        serialize = "estimatedRequestsRemaining"
    ))]
    #[ts(rename = "estimatedRequestsRemaining")]
    pub estimated_requests_remaining: u32,
    pub estimated_tokens_remaining: u32,
    pub custom_limit: bool,
    pub resets: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct UsageSummary {
    pub id: String,
    pub label: String,
    pub conversations: i32,
    pub learner_messages: i32,
    pub partner_messages: i32,
    pub attempts: i32,
    pub input_tokens: i32,
    pub output_tokens: i32,
    pub unknown_usage: i32,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSnapshot {
    pub revision: i32,
    pub global: UsageSummary,
    pub languages: Vec<UsageSummary>,
    pub partners: Vec<UsageSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CustomEndpoint {
    pub base_url: String,
    pub standard_model: String,
    pub fast_model: String,
    pub bearer_auth: bool,
    pub transcription_model: Option<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct AccessSettings {
    pub revision: i32,
    pub groq_key_configured: bool,
    pub custom_key_configured: bool,
    pub custom: CustomEndpoint,
}
