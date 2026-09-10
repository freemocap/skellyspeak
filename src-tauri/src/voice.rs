use crate::{Application, access, audio, model::*};
use std::sync::Arc;

pub struct Recording {
    id: String,
    conversation: String,
    target: access::ResolvedTarget,
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
    let target = access::resolve(&store.connection, access::Capability::Transcription)?;
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
        target,
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
        if store.connection_config()?.revision != recording.target.revision {
            return Err(fault("AI connection changed during recording."));
        }
        (
            recording.target.credential.clone(),
            store.snapshot()?.learner.id,
        )
    };
    let wav = tauri::async_runtime::spawn_blocking(move || recording.capture.finish())
        .await
        .map_err(|_| fault("Audio processing stopped unexpectedly."))?
        .map_err(fault)?;
    let token = match credential {
        Some(id) => crate::read_secret(id).await?,
        None => zeroize::Zeroizing::new(String::new()),
    };
    if state.lock()?.connection_config()?.revision != recording.target.revision {
        return Err(fault("AI connection changed before transcription."));
    }
    let client = crate::provider::client()?;
    let request = access::transcribe(
        &client,
        &recording.target,
        &token,
        wav,
        &recording.language,
        &install,
    );
    tokio::pin!(request);
    let text = loop {
        tokio::select! {
            value = &mut request => break value?,
            _ = tokio::time::sleep(std::time::Duration::from_millis(100)) => {
                let store = state.lock()?;
                if store.connection_config()?.revision != recording.target.revision || !store.snapshot()?.conversations.iter().any(|c|c.id == recording.conversation && !c.archived) {
                    return Err(fault("Transcription cancelled: the connection or conversation changed. Provider billing may continue."));
                }
            }
        }
    };
    let store = state.lock()?;
    if store.connection_config()?.revision != recording.target.revision
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
    Ok(text)
}
