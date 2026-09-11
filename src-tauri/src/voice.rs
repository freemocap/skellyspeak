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
) -> Result<RecordingStarted> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || start_capture(&state, conversation_id))
        .await
        .map_err(|_| fault("Microphone startup stopped unexpectedly."))?
}
fn start_capture(state: &Arc<Application>, conversation_id: String) -> Result<RecordingStarted> {
    let mut slot = state
        .capture
        .lock()
        .map_err(|_| fault("Microphone state unavailable."))?;
    if slot.is_some() {
        return Err(fault("A recording is already running."));
    }
    let store = state.lock()?;
    let target = access::resolve(&store.connection, access::Capability::Transcription)?;
    crate::holds::check(&store.connection, &target)?;
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
    let started = RecordingStarted { recording_id: recording.id.clone(), samples_per_second: recording.capture.wave_samples_per_second() };
    *slot = Some(recording);
    Ok(started)
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
    let validate = || {
        let store = state.lock()?;
        crate::holds::check(&store.connection, &recording.target)?;
        crate::transcription::permitted(
            &store.connection,
            &recording.conversation,
            &recording.target,
        )?;
        Ok(())
    };
    let _permit = state.admission.audio(validate).await?;
    let token = match credential {
        Some(id) => crate::read_secret(id).await?,
        None => zeroize::Zeroizing::new(String::new()),
    };
    validate()?;
    let client = crate::provider::client()?;
    state
        .lock()?
        .begin_transcription(&recording_id, &recording.conversation, &recording.target)?;
    let request = access::transcribe(
        &client,
        &recording.target,
        &token,
        wav,
        &recording.language,
        &install,
    );
    tokio::pin!(request);
    let result = loop {
        tokio::select! {
            value = &mut request => {
                if let Err(error) = &value {
                    state.lock()?.note_refusal(&recording.target, error)?;
                }
                break value;
            },
            _ = tokio::time::sleep(std::time::Duration::from_millis(100)) => {
                let store = state.lock()?;
                if let Err(error) = crate::transcription::permitted(&store.connection, &recording.conversation, &recording.target) {
                    if error.code != ErrorCode::Conflict { return Err(error); }
                    break Err(AppError::new(ErrorCode::UnknownOutcome, "Transcription cancelled: the connection or conversation changed. Provider billing may continue."));
                }
            }
        }
    };
    state.lock()?.finish_transcription(
        &recording_id,
        &recording.conversation,
        &recording.target,
        result,
    )
}
