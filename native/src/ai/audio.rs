//! Internal audio boundary. Callers supply captured targets and credentials;
//! adapters alone build provider payloads and decode responses. These are not IPC types.
use crate::ai::connections::access::ResolvedTarget;
use crate::language::text_diagnostics::TranscriptDiagnostics;
use crate::ai::transport::{speech_provider, transcription_provider};
use crate::model::{ConnectionRoute, Result};

pub struct SpeechInput {
    pub text: String,
    pub voice: String,
    pub language: String,
}
pub struct SpeechOutcome {
    pub diagnostics: Option<serde_json::Value>,
    pub(crate) transcript_diagnostics: Option<TranscriptDiagnostics>,
    pub audio: Result<Vec<u8>>,
    pub actual_model: Option<String>,
    pub provider_id: Option<String>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cost_micros: Option<u64>,
    pub finish_reason: Option<String>,
}
/// Captured recording input. None leaves language selection to the provider;
/// it must not disable recording or be replaced with an unrelated language code.
pub struct TranscriptionInput {
    pub wav: Vec<u8>,
    pub language: Option<String>,
    pub variety_hint: String,
}

#[derive(Debug)]
pub struct TranscriptionResponse {
    pub diagnostics: Option<serde_json::Value>,
    pub text: String,
    pub timing: Option<crate::speech::analysis::fluency::TranscriptTiming>,
    /// Optional provider-specific evidence for the diagnostic inspector only.
    pub whisper_segments: Option<Vec<crate::speech::analysis::fluency::Segment>>,
}
/// Run the adapter's request validation before admitting a paid attempt.
/// Provider JSON remains inside the transport boundary.
pub fn validate_speech(target: &ResolvedTarget, input: &SpeechInput) -> Result<()> {
    if target.route == ConnectionRoute::Openrouter {
        speech_provider::payload(target, input).map(|_| ())
    } else {
        crate::ai::transport::service_audio::validate(input)
    }
}

pub async fn synthesize(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: &SpeechInput,
    install: &str,
) -> SpeechOutcome {
    if target.route == ConnectionRoute::Openrouter {
        speech_provider::synthesize(client, target, key, input, install).await
    } else {
        crate::ai::transport::service_audio::synthesize(client, target, key, input, install).await
    }
}

pub async fn transcribe(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: TranscriptionInput,
    install: &str,
) -> Result<TranscriptionResponse> {
    transcription_provider::transcribe(client, target, key, input, install).await
}
