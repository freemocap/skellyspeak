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
    language: crate::ai::audio::TranscriptionLanguage,
    context: Option<String>,
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
        .map_err(|cause| {
            crate::diagnostics::failures::join(
                &cause,
                "voice.rs",
                fault("Microphone startup stopped unexpectedly."),
            )
        })?
}
fn start_capture(state: &Arc<Application>, conversation_id: String) -> Result<RecordingStarted> {
    let mut slot = state.capture.lock().map_err(|_| {
        crate::diagnostics::failures::poisoned(fault("Microphone state unavailable."))
    })?;
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
    let language = crate::ai::audio::TranscriptionLanguage {
        language_id: conversation.language_id.clone(),
        variety_id: conversation.settings.variety_id.clone(),
        language_tag: context
            .external_tags
            .get("language_tag")
            .cloned()
            .ok_or_else(|| fault("The selected language has no language tag."))?,
    };
    crate::ai::audio::validate_transcription_language(&target, &language)?;
    let previous: Option<String> = store.connection.query_row(
        "SELECT m.text FROM messages m JOIN turns t ON t.id=m.turn_id WHERE m.conversation_id=?1 AND m.role='assistant' AND NOT EXISTS(SELECT 1 FROM turns child WHERE child.replaces_turn_id=t.id) AND EXISTS(SELECT 1 FROM operations o WHERE o.turn_id=t.id AND o.kind IN ('persona_reply','persona_opening') AND o.state='succeeded') ORDER BY m.sequence DESC LIMIT 1",
        [&conversation_id], |row| row.get(0),
    ).optional()?;
    drop(store);
    let recording = Recording {
        id: uuid::Uuid::new_v4().to_string(),
        conversation: conversation_id,
        target,
        language,
        context: previous,
        #[cfg(desktop)]
        capture: audio::start(None).map_err(fault)?,
    };
    let started = RecordingStarted {
        recording_id: recording.id.clone(),
        browser_capture: cfg!(mobile),
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
    let slot = state.capture.lock().map_err(|_| {
        crate::diagnostics::failures::poisoned(fault("Microphone state unavailable."))
    })?;
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
    let mut slot = state.capture.lock().map_err(|_| {
        crate::diagnostics::failures::poisoned(fault("Microphone state unavailable."))
    })?;
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
        let mut slot = state.capture.lock().map_err(|_| {
            crate::diagnostics::failures::poisoned(fault("Microphone state unavailable."))
        })?;
        if slot.as_ref().is_none_or(|r| r.id != recording_id) {
            return Err(fault("Recording is no longer active."));
        }
        slot.take()
            .ok_or_else(|| fault("Recording is unavailable."))?
    };
    let (credential, install) = {
        let store = state.lock()?;
        crate::speech::recording::transcription::permitted(
            &store.connection,
            &recording.conversation,
            &recording.target,
        )?;
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
        .map_err(|cause| {
            crate::diagnostics::failures::join(
                &cause,
                "voice.rs",
                fault("Audio processing stopped unexpectedly."),
            )
        })?
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
            .map_err(|cause| {
                crate::diagnostics::failures::base64(
                    &cause,
                    "voice.rs_base64",
                    fault("Invalid recording encoding."),
                )
            })?;
        if bytes.len() < 44 || &bytes[..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
            return Err(fault("Recording must be WAV audio."));
        }
        bytes
    };
    let inspection_recording = recording.id.clone();
    let inspection_conversation = recording.conversation.clone();
    let (wav, mut inspection) = tauri::async_runtime::spawn_blocking(move || {
        let (inspection, _) = crate::speech::analysis::audio_inspection::inspect_wav(
            &wav,
            &inspection_recording,
            &inspection_conversation,
        )?;
        Ok::<_, AppError>((wav, inspection))
    })
    .await
    .map_err(|cause| {
        crate::diagnostics::failures::join(
            &cause,
            "voice.rs",
            fault("Audio inspection stopped unexpectedly."),
        )
    })??;
    let validate = || {
        let store = state.lock()?;
        if crate::conversations::execution::config(&store.connection)?.paused {
            return Err(AppError::new(
                ErrorCode::AdmissionHeld,
                "Transcription stopped: AI execution is paused.",
            ));
        }
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

    let input = crate::ai::audio::TranscriptionRequest {
        wav,
        language: recording.language.clone(),
        context: recording.context.clone(),
    };
    let result = crate::ai::policy::retry::run(
        || {
            crate::ai::audio::transcribe(
                &client,
                &recording.target,
                &token,
                input.clone(),
                &install,
            )
        },
        validate,
        |error| {
            state
                .lock()?
                .record_transcription_retry(&recording_id, error)
        },
    )
    .await;
    if let Err(error) = &result {
        state.lock()?.note_refusal(&recording.target, error)?;
    }
    let diagnostics = result.as_ref().ok().and_then(|r| r.diagnostics.clone());
    let result = result.map(|response| {
        crate::speech::analysis::audio_inspection::attach_words(
            &mut inspection,
            response.result.timing.as_ref(),
        );
        response.result.text
    });
    let text = state.lock()?.finish_transcription_with_diagnostics(
        &recording_id,
        &recording.conversation,
        &recording.target,
        result,
        diagnostics.as_ref(),
    )?;
    Ok(
        crate::speech::analysis::audio_inspection::TranscriptionInspectionResult {
            text,
            inspection,
            audio_base64,
            diagnostics,
        },
    )
}
