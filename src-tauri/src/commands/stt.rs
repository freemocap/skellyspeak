//! Speech to text. One provider and model, named here so a switch is one edit.

use base64::Engine;
use log::{error, info, warn};
use tauri::{State};
use crate::languages::{iso639};
use crate::AppState;

const GROQ_STT_MODEL: &str = "whisper-large-v3";
/// Android WebView emits webm/opus; iOS emits mp4/aac — the upload type must
/// follow the platform when the ladder reaches iOS.
const STT_UPLOAD_MIME: &str = "audio/webm";
const STT_UPLOAD_NAME: &str = "audio.webm";
// ─── STT (Groq Whisper) ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn transcribe_audio(
    state: State<'_, AppState>,
    audio_base64: String,
    prompt: Option<String>,
) -> Result<String, String> {
    let settings = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    // Where speech-to-text goes is decided in exactly one place, alongside the
    // chat provider — hosted proxies it, the other modes use Groq directly.
    let endpoint = settings.stt_endpoint().inspect_err(|e| {
        warn!("[cmd] transcribe_audio rejected: {e}");
    })?;

    let started = std::time::Instant::now();
    let audio = base64::engine::general_purpose::STANDARD
        .decode(&audio_base64)
        .map_err(|e| format!("invalid audio data: {e}"))?;
    info!(
        "[cmd] transcribe_audio: {} bytes, target={}",
        audio.len(),
        settings.target_language
    );

    let target = settings.target_language.clone();
    let language = iso639(&target);
    let file_part = reqwest::multipart::Part::bytes(audio)
        .file_name(STT_UPLOAD_NAME)
        .mime_str(STT_UPLOAD_MIME)
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new()
        .text("model", GROQ_STT_MODEL)
        .text("language", language)
        .text("response_format", "json")
        // Context hint: biases recognition toward live vocabulary. Whisper
        // leans on this heavily for lower-resource languages like Arabic.
        .text("prompt", prompt.unwrap_or_default())
        .part("file", file_part);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .post(&endpoint.url)
        .bearer_auth(&endpoint.api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("transcription request failed: {e}"))?;

    let status = response.status();
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("invalid transcription response: {e}"))?;
    if !status.is_success() {
        error!("[cmd] transcription API error {status}: {}", body);
        return Err(format!(
            "transcription API error {status}: {}",
            body
        ));
    }
    let text = body["text"].as_str().unwrap_or_default().trim().to_string();
    info!(
        "[cmd] transcribe_audio done in {:.1}s: {:?}",
        started.elapsed().as_secs_f32(),
        text
    );
    Ok(text)
}
