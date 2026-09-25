//! Internal audio boundary. Callers supply captured targets and credentials;
//! adapters alone build provider payloads and decode responses. These are not IPC types.
use crate::ai::connections::access::ResolvedTarget;
use crate::ai::transport::transcription_provider;
use crate::model::{AppError, Result};

#[derive(Clone)]
pub struct SpeechInput {
    pub text: String,
    pub voice: String,
    pub language: String,
}
#[derive(Clone)]
pub struct SpeechOutcome {
    pub diagnostics: Option<serde_json::Value>,
    pub audio: Result<Vec<u8>>,
    pub actual_model: Option<String>,
    pub provider_id: Option<String>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cost_micros: Option<u64>,
    pub finish_reason: Option<String>,
}
/// Captured recording input. Language is explicit; adapters never auto-detect silently.
#[derive(Clone)]
pub struct TranscriptionRequest {
    pub wav: Vec<u8>,
    pub language: TranscriptionLanguage,
    pub context: Option<String>,
}

#[derive(Clone)]
pub struct TranscriptionLanguage {
    pub language_id: String,
    pub variety_id: String,
    pub language_tag: String,
}
#[derive(Debug)]
pub struct TranscriptionOutcome {
    pub result: TranscriptionResult,
    pub diagnostics: Option<serde_json::Value>,
}
#[derive(Debug)]
pub struct TranscriptionResult {
    pub text: String,
    pub timing: Option<crate::speech::analysis::fluency::TranscriptTiming>,
}
/// Run the adapter's request validation before admitting a paid attempt.
/// Provider JSON remains inside the transport boundary.
pub fn validate_speech(target: &ResolvedTarget, input: &SpeechInput) -> Result<()> {
    let _ = target;
    crate::ai::transport::service_audio::validate(input)
}

pub async fn synthesize(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: &SpeechInput,
    install: &str,
) -> SpeechOutcome {
    crate::ai::transport::service_audio::synthesize(client, target, key, input, install).await
}

pub async fn transcribe(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: TranscriptionRequest,
    install: &str,
) -> Result<TranscriptionOutcome> {
    transcription_provider::transcribe(client, target, key, input, install).await
}

pub fn validate_transcription_language(
    target: &ResolvedTarget,
    language: &TranscriptionLanguage,
) -> Result<()> {
    transcription_provider::validate_language(target, language).map(|_| ())
}

impl SpeechOutcome {
    pub(crate) fn empty() -> Self {
        Self {
            diagnostics: None,
            audio: Err(AppError::new(
                crate::model::ErrorCode::UnknownOutcome,
                "Speech outcome is unknown after an interrupted response. Processing may have incurred a charge. No automatic retry was made.",
            )),
            actual_model: None,
            provider_id: None,
            input_tokens: None,
            output_tokens: None,
            cost_micros: None,
            finish_reason: None,
        }
    }
}

/// The speech request for target-language text: the source contract, the
/// language label and route validation shared by persona speech and explicit
/// reading requests.
pub(crate) fn speech_input(
    target: &crate::ai::connections::access::ResolvedTarget,
    text: String,
    voice: String,
    context: &crate::configuration::LanguageContext,
) -> Result<crate::ai::audio::SpeechInput> {
    if text.trim().is_empty()
        || text.chars().count() > 12000
        || text.contains('\0')
        || voice.is_empty()
    {
        return Err(crate::model::AppError::new(
            crate::model::ErrorCode::Validation,
            "Speech input exceeds its source contract.",
        ));
    }
    let input = crate::ai::audio::SpeechInput {
        text,
        voice,
        language: format!("{} — {}", context.target_name, context.variety_name),
    };
    crate::ai::audio::validate_speech(target, &input)?;
    Ok(input)
}
