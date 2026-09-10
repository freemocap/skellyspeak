use crate::{Application, audio, hosted, model::*, provider};
use std::sync::Arc;

pub struct Recording {
    id: String,
    conversation: String,
    revision: i32,
    language: String,
    capture: audio::Capture,
}
fn fault(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::Provider, message)
}
#[tauri::command]
pub async fn mic_start(
    state: tauri::State<'_, Arc<Application>>,
    conversation_id: String,
) -> Result<String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || start_capture(&state, conversation_id))
        .await
        .map_err(|_| fault("Microphone startup stopped unexpectedly."))?
}
fn start_capture(state: &Arc<Application>, conversation_id: String) -> Result<String> {
    let mut slot = state
        .capture
        .lock()
        .map_err(|_| fault("Microphone state unavailable."))?;
    if slot.is_some() {
        return Err(fault("A recording is already running."));
    }
    let store = state.lock()?;
    let config = store.connection_config()?;
    if config.route != ConnectionRoute::Hosted || !config.signed_in {
        return Err(fault("Sign in with Google to use voice transcription."));
    }
    let snapshot = store.snapshot()?;
    let conversation = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation_id && !c.archived)
        .ok_or_else(|| fault("Conversation is unavailable."))?;
    drop(store);
    let recording = Recording {
        id: uuid::Uuid::new_v4().to_string(),
        conversation: conversation_id,
        revision: config.revision,
        language: conversation.language_id.clone(),
        capture: audio::start(None).map_err(fault)?,
    };
    let id = recording.id.clone();
    *slot = Some(recording);
    Ok(id)
}
#[tauri::command]
pub fn mic_wave(
    state: tauri::State<'_, Arc<Application>>,
    recording_id: String,
) -> Result<Vec<f32>> {
    let slot = state
        .capture
        .lock()
        .map_err(|_| fault("Microphone state unavailable."))?;
    let recording = slot
        .as_ref()
        .filter(|r| r.id == recording_id)
        .ok_or_else(|| fault("Recording is no longer active."))?;
    recording.capture.take_wave().map_err(fault)
}
#[tauri::command]
pub fn mic_cancel(state: tauri::State<'_, Arc<Application>>, recording_id: String) -> Result<()> {
    let mut slot = state
        .capture
        .lock()
        .map_err(|_| fault("Microphone state unavailable."))?;
    if slot.as_ref().is_some_and(|r| r.id == recording_id) {
        slot.take();
    }
    Ok(())
}
#[tauri::command]
pub async fn mic_transcribe(
    state: tauri::State<'_, Arc<Application>>,
    recording_id: String,
) -> Result<String> {
    let recording = {
        let mut slot = state
            .capture
            .lock()
            .map_err(|_| fault("Microphone state unavailable."))?;
        if !slot.as_ref().is_some_and(|r| r.id == recording_id) {
            return Err(fault("Recording is no longer active."));
        }
        slot.take()
            .ok_or_else(|| fault("Recording is unavailable."))?
    };
    let (credential, install) = {
        let store = state.lock()?;
        if store.connection_config()?.revision != recording.revision {
            return Err(fault("AI connection changed during recording."));
        }
        let id = store
            .hosted_credential()?
            .ok_or_else(|| fault("Sign in with Google again."))?;
        (id, store.snapshot()?.learner.id)
    };
    let wav = tauri::async_runtime::spawn_blocking(move || recording.capture.finish())
        .await
        .map_err(|_| fault("Audio processing stopped unexpectedly."))?
        .map_err(fault)?;
    let token = crate::read_secret(credential).await?;
    if state.lock()?.connection_config()?.revision != recording.revision {
        return Err(fault("AI connection changed before transcription."));
    }
    let form = reqwest::multipart::Form::new()
        .text("model", "whisper-large-v3")
        .text("response_format", "json")
        .text("language", recording.language)
        .part(
            "file",
            reqwest::multipart::Part::bytes(wav)
                .file_name("audio.wav")
                .mime_str("audio/wav")
                .map_err(|_| fault("Audio upload type is invalid."))?,
        );
    let response = hosted::identity(
        provider::client()?
            .post(format!("{}/v1/audio/transcriptions", hosted::ORIGIN))
            .bearer_auth(token.as_str()),
        &install,
    )
    .multipart(form)
    .send()
    .await
    .map_err(|_| fault("Transcription request failed. No automatic retry was made."))?;
    #[derive(serde::Deserialize)]
    struct Transcript {
        text: String,
    }
    let transcript: Transcript = serde_json::from_slice(&hosted::body(response).await?)
        .map_err(|_| fault("Invalid transcription response."))?;
    if transcript.text.len() > 20000 || transcript.text.contains('\0') {
        return Err(fault("Transcription exceeds the message limits."));
    }
    let store = state.lock()?;
    if store.connection_config()?.revision != recording.revision
        || !store
            .snapshot()?
            .conversations
            .iter()
            .any(|c| c.id == recording.conversation && !c.archived)
    {
        return Err(fault(
            "The conversation or AI connection changed. Transcript was not inserted.",
        ));
    }
    Ok(transcript.text)
}
