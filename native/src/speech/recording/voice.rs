use crate::ai::connections::access;
use crate::application::Application;
use crate::model::*;
#[cfg(desktop)]
use crate::speech::recording::audio;
use rusqlite::OptionalExtension;
use std::sync::Arc;

pub struct Recording {
    id: String,
    conversation: String,
    target: access::ResolvedTarget,
    language: String,
    variety_hint: String,
    #[cfg(desktop)]
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
    crate::ai::policy::holds::check(&store.connection, &target)?;
    let snapshot = store.snapshot()?;
    let conversation = snapshot
        .conversations
        .iter()
        .find(|c| c.id == conversation_id && !c.archived)
        .ok_or_else(|| fault("Conversation is unavailable."))?;
    let context = store.config.resolve_pair(
        &conversation.language_id,
        Some(&conversation.settings.variety_id),
        &conversation.settings.explanation_language,
        Some(&conversation.settings.explanation_variety_id),
    )?;
    let language = context
        .external_tags
        .get("transcription")
        .cloned()
        .ok_or_else(|| {
            fault("Transcription has no configured language mapping for this variety.")
        })?;
    let native_name = store
        .config
        .language(&conversation.language_id)?
        .native_name;
    let previous: Option<String> = store.connection.query_row(
        "SELECT m.text FROM messages m JOIN turns t ON t.id=m.turn_id WHERE m.conversation_id=?1 AND m.role='assistant' AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id) AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=t.id AND o.kind IN ('persona_reply','persona_opening') AND o.state='succeeded') ORDER BY m.sequence DESC LIMIT 1",
        [&conversation_id], |row| row.get(0),
    ).optional()?;
    let variety_hint = super::transcription_context::prompt(&native_name, previous.as_deref());
    drop(store);
    let recording = Recording {
        id: uuid::Uuid::new_v4().to_string(),
        conversation: conversation_id,
        target,
        language,
        variety_hint,
        #[cfg(desktop)]
        capture: audio::start(None).map_err(fault)?,
    };
    let started = RecordingStarted {
        recording_id: recording.id.clone(),
        #[cfg(desktop)]
        samples_per_second: recording.capture.wave_samples_per_second(),
        #[cfg(mobile)]
        samples_per_second: 750.0,
    };
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
    #[cfg(desktop)]
    {
        recording.capture.take_wave().map_err(fault)
    }
    #[cfg(mobile)]
    {
        let _ = recording;
        Ok(Vec::new())
    }
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
    audio_base64: Option<String>,
) -> Result<crate::speech::analysis::audio_inspection::TranscriptionInspectionResult> {
    let recording = {
        let mut slot = state
            .capture
            .lock()
            .map_err(|_| fault("Microphone state unavailable."))?;
        if slot.as_ref().is_none_or(|r| r.id != recording_id) {
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
    #[cfg(desktop)]
    if audio_base64.is_some() {
        return Err(fault("Desktop capture does not accept browser audio."));
    }
    #[cfg(desktop)]
    let wav = tauri::async_runtime::spawn_blocking(move || recording.capture.finish())
        .await
        .map_err(|_| fault("Audio processing stopped unexpectedly."))?
        .map_err(fault)?;
    #[cfg(mobile)]
    let wav = {
        use base64::Engine;
        let encoded = audio_base64.ok_or_else(|| fault("Microphone audio is missing."))?;
        if encoded.len() > 24 * 1024 * 1024 {
            return Err(fault("Recording exceeds its size limit."));
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map_err(|_| fault("Invalid recording encoding."))?;
        if bytes.len() < 44 || &bytes[..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
            return Err(fault("Recording must be WAV audio."));
        }
        bytes
    };
    let inspection_recording = recording.id.clone();
    let inspection_conversation = recording.conversation.clone();
    let (wav, mut inspection, local) = tauri::async_runtime::spawn_blocking(move || {
        let (inspection, local) = crate::speech::analysis::audio_inspection::inspect_wav(
            &wav,
            &inspection_recording,
            &inspection_conversation,
        )?;
        Ok::<_, AppError>((wav, inspection, local))
    })
    .await
    .map_err(|_| fault("Audio inspection stopped unexpectedly."))??;
    let validate = || {
        let store = state.lock()?;
        crate::ai::policy::holds::check(&store.connection, &recording.target)?;
        crate::speech::recording::transcription::permitted(
            &store.connection,
            &recording.conversation,
            &recording.target,
        )?;
        Ok(())
    };
    let _permit = state.admission.audio(validate).await?;
    let token = match credential {
        Some(id) => crate::application::read_secret(id).await?,
        None => zeroize::Zeroizing::new(String::new()),
    };
    validate()?;
    let client = crate::ai::transport::provider::client()?;
    state
        .lock()?
        .begin_transcription(&recording_id, &recording.conversation, &recording.target)?;
    use base64::Engine;
    let audio_base64 = base64::engine::general_purpose::STANDARD.encode(&wav);
    let mut segments = Vec::new();
    let request = access::transcribe(
        &client,
        &recording.target,
        &token,
        wav,
        &recording.language,
        &recording.variety_hint,
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
                if let Err(error) = crate::speech::recording::transcription::permitted(&store.connection, &recording.conversation, &recording.target) {
                    if error.code != ErrorCode::Conflict { return Err(error); }
                    break Err(AppError::new(ErrorCode::UnknownOutcome, "Transcription cancelled: the connection or conversation changed. Provider billing may continue."));
                }
            }
        }
    };
    let result = result.and_then(|response| {
        crate::speech::analysis::audio_inspection::attach_words(
            &mut inspection,
            &local,
            response.verbose.as_ref(),
        )?;
        segments = response
            .verbose
            .as_ref()
            .map(|value| value.segments.clone())
            .unwrap_or_default();
        Ok(response.text)
    });
    let text = state.lock()?.finish_transcription(
        &recording_id,
        &recording.conversation,
        &recording.target,
        result,
    )?;
    Ok(
        crate::speech::analysis::audio_inspection::TranscriptionInspectionResult {
            text,
            inspection,
            audio_base64,
            segments,
        },
    )
}
