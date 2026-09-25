use crate::ai::connections::access;
use crate::application::Application;
use crate::model::*;
#[cfg(desktop)]
use crate::speech::recording::audio;
use crate::speech::recording::owner::RecordingOwner;
use std::sync::Arc;

/// The complete retained recognition result, shared by recording consumers.
#[tauri::command]
pub fn get_transcription_result(
    state: tauri::State<'_, Arc<Application>>,
    recording_id: String,
) -> Result<Option<crate::ai::audio::TranscriptionResult>> {
    crate::speech::recording::results::result(&state.lock()?.connection, &recording_id)
}

pub struct Recording {
    id: String,
    install: String,
    owner: RecordingOwner,
    visit: Option<String>,
    target: access::ResolvedTarget,
    language: crate::ai::audio::TranscriptionLanguage,
    context: Option<String>,
    #[cfg(desktop)]
    capture: audio::Capture,
}
#[derive(Clone)]
pub(super) struct Transcription {
    pub id: String,
    install: String,
    owner: RecordingOwner,
    visit: Option<String>,
    target: access::ResolvedTarget,
    language: crate::ai::audio::TranscriptionLanguage,
    context: Option<String>,
}
impl Transcription {
    pub(super) fn capture_permitted(&self, state: &Application) -> Result<()> {
        let store = state.lock()?;
        if store.snapshot()?.learner.id != self.install {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Recording belongs to a different workspace.",
            ));
        }
        super::transcription::permitted(&store.connection, &self.owner, &self.target)?;
        crate::ai::policy::holds::check(&store.connection, &self.target)?;
        if crate::ai::connections::configuration::config(&store.connection)?.paused {
            return Err(AppError::new(
                ErrorCode::AdmissionHeld,
                "Listening stopped: AI execution is paused.",
            ));
        }
        if let RecordingOwner::DrillItem(item) = &self.owner {
            let current = crate::drill::sessions::active_visit(&store.connection, item)?;
            if Some(current.as_str()) != self.visit.as_deref() {
                return Err(AppError::new(
                    ErrorCode::Conflict,
                    "Listening stopped because the practice visit changed.",
                ));
            }
        }
        Ok(())
    }
}
impl Recording {
    pub(super) fn id(&self) -> &str {
        &self.id
    }
    pub(super) fn request(&self) -> Transcription {
        Transcription {
            id: self.id.clone(),
            install: self.install.clone(),
            owner: self.owner.clone(),
            visit: self.visit.clone(),
            target: self.target.clone(),
            language: self.language.clone(),
            context: self.context.clone(),
        }
    }
    #[cfg(desktop)]
    pub(super) fn drain(&self) -> Result<(u32, Vec<f32>)> {
        self.capture.drain().map_err(fault)
    }
}
fn fault(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::Provider, message)
}
#[tauri::command]
pub async fn mic_start(
    state: tauri::State<'_, Arc<Application>>,
    owner: RecordingOwner,
) -> Result<RecordingStarted> {
    let state = state.inner().clone();
    let prepared = super::preflight::prepare(&state, &owner).await?;
    tauri::async_runtime::spawn_blocking(move || {
        start_prepared_capture(&state, owner, Some(prepared))
    })
    .await
    .map_err(|cause| {
        crate::diagnostics::failures::join(
            &cause,
            "voice.rs",
            fault("Microphone startup stopped unexpectedly."),
        )
    })?
}
/// One capture at a time, whatever owns it: Chat and Drill share this slot.
#[cfg(test)]
pub(crate) fn start_capture(
    state: &Arc<Application>,
    owner: RecordingOwner,
) -> Result<RecordingStarted> {
    start_prepared_capture(state, owner, None)
}
pub(super) fn start_prepared_capture(
    state: &Arc<Application>,
    owner: RecordingOwner,
    prepared: Option<super::preflight::Prepared>,
) -> Result<RecordingStarted> {
    let mut slot = state.capture.lock().map_err(|_| {
        crate::diagnostics::failures::poisoned(fault("Microphone state unavailable."))
    })?;
    if slot.is_some() {
        return Err(fault("A recording is already running."));
    }
    let store = state.lock()?;
    // Language, variety and recognizer context come from the owner's record.
    let scope = owner.scope(&store)?;
    let target = if let Some(prepared) = prepared {
        prepared.validate(&store.connection, &scope.language_context)?;
        prepared.target
    } else {
        crate::ai::connections::speech_routing::resolve(
            &store.connection,
            access::Capability::Transcription,
            &scope.language_context,
        )?
    };
    crate::ai::policy::holds::check(&store.connection, &target)?;
    let visit = match &owner {
        RecordingOwner::Conversation(_) => None,
        RecordingOwner::DrillItem(item) => Some(crate::drill::sessions::active_visit(
            &store.connection,
            item,
        )?),
    };
    crate::ai::audio::validate_transcription_language(&target, &scope.language)?;
    let microphone = super::microphone::selected(&store.connection)?;
    let install = store.snapshot()?.learner.id;
    drop(store);
    let recording = Recording {
        id: uuid::Uuid::new_v4().to_string(),
        install,
        owner,
        visit,
        target,
        language: scope.language,
        context: scope.context,
        #[cfg(desktop)]
        capture: audio::start(microphone.as_deref()).map_err(fault)?,
    };
    let started = RecordingStarted {
        recording_id: recording.id.clone(),
        browser_capture: cfg!(mobile),
        browser_device_id: if cfg!(mobile) { microphone } else { None },
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
    {
        let slot = state.capture.lock().map_err(|_| {
            crate::diagnostics::failures::poisoned(fault("Microphone state unavailable."))
        })?;
        if let Some(recording) = slot.as_ref().filter(|r| r.id == recording_id) {
            #[cfg(desktop)]
            {
                return recording.capture.take_wave().map_err(fault);
            }
            #[cfg(mobile)]
            {
                let _ = recording;
                return Ok(Vec::new());
            }
        }
    }
    // A listening run releases the microphone before it reports that it has
    // stopped; between the two, its waveform is simply finished. The capture lock
    // is released first: starting a run takes the listening lock, then capture.
    if super::continuous::is_listening_run(&state, &recording_id) {
        return Ok(Vec::new());
    }
    Err(fault("Recording is no longer active."))
}
#[tauri::command]
pub fn mic_cancel(state: tauri::State<'_, Arc<Application>>, recording_id: String) -> Result<()> {
    super::continuous::cancel_session(&state, &recording_id);
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
    let request = recording.request();
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
    transcribe(state.inner().clone(), request, wav).await
}

// Manual clips and segmented utterances share inspection, admission, receipts,
// provider execution, and durable publication without a second attempt writer.
pub(super) async fn transcribe(
    state: Arc<Application>,
    recording: Transcription,
    wav: Vec<u8>,
) -> Result<crate::speech::analysis::audio_inspection::TranscriptionInspectionResult> {
    let recording_id = recording.id.clone();
    let validate = || {
        let store = state.lock()?;
        if store.snapshot()?.learner.id != recording.install {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Recording belongs to a different workspace.",
            ));
        }
        super::transcription::permitted(&store.connection, &recording.owner, &recording.target)
    };
    validate()?;
    let inspection_recording = recording.id.clone();
    let inspection_owner = recording.owner.clone();
    let (wav, mut inspection) = tauri::async_runtime::spawn_blocking(move || {
        let (inspection, _) = crate::speech::analysis::audio_inspection::inspect_wav(
            &wav,
            &inspection_recording,
            &inspection_owner,
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
    {
        let mut store = state.lock()?;
        if store.snapshot()?.learner.id != recording.install {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Recording belongs to a different workspace.",
            ));
        }
        store.reserve_transcription_in_visit(
            &recording_id,
            &recording.owner,
            &recording.target,
            recording.visit.as_deref(),
        )?;
    }
    use base64::Engine;
    let audio_base64 = base64::engine::general_purpose::STANDARD.encode(&wav);

    let input = crate::ai::audio::TranscriptionRequest {
        wav,
        language: recording.language.clone(),
        context: recording.context.clone(),
    };
    let result = state
        .shared_transcription(
            recording.target.clone(),
            input.clone(),
            recording.install.clone(),
            &recording_id,
            validate,
        )
        .await
        .and_then(|saved| {
            let result = serde_json::from_slice(&saved.payload).map_err(|_| {
                AppError::new(
                    ErrorCode::Storage,
                    "Saved transcription has an invalid shape.",
                )
            })?;
            let mut diagnostics = saved.metadata["diagnostics"].clone();
            if diagnostics.is_null() {
                diagnostics = serde_json::json!({});
            }
            diagnostics["sourceExecutionId"] = serde_json::json!(saved.execution);
            diagnostics["cacheHit"] = serde_json::json!(saved.cached);
            Ok(crate::ai::audio::TranscriptionOutcome {
                result,
                diagnostics: Some(diagnostics),
            })
        });
    {
        let mut store = state.lock()?;
        if store.snapshot()?.learner.id != recording.install {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Recording belongs to a different workspace.",
            ));
        }
        if let Err(error) = &result {
            store.note_refusal(&recording.target, error)?;
        }
    }
    let mut diagnostics = result.as_ref().ok().and_then(|r| r.diagnostics.clone());
    if result.is_ok() && matches!(recording.owner, RecordingOwner::DrillItem(_)) {
        let reliability = crate::drill::reliability::assess(&inspection, diagnostics.as_ref());
        diagnostics.get_or_insert_with(|| serde_json::json!({}))["drill_reliability"] =
            serde_json::to_value(reliability)?;
    }
    let result = result.map(|response| {
        crate::speech::analysis::audio_inspection::attach_words(
            &mut inspection,
            response.result.timing.as_ref(),
        );
        response.result
    });
    let evidence = result.as_ref().ok();
    let text = {
        let mut store = state.lock()?;
        if store.snapshot()?.learner.id != recording.install {
            return Err(AppError::new(
                ErrorCode::SessionExpired,
                "Recording belongs to a different workspace.",
            ));
        }
        store.publish_recording_result(
            &recording_id,
            &recording.owner,
            &recording.target,
            result
                .as_ref()
                .map(|value| value.text.clone())
                .map_err(Clone::clone),
            diagnostics.as_ref(),
            Some(&input.wav),
            evidence,
        )?
    };
    Ok(
        crate::speech::analysis::audio_inspection::TranscriptionInspectionResult {
            text,
            inspection,
            audio_base64,
            diagnostics,
        },
    )
}

#[cfg(all(test, desktop))]
pub(super) fn fixture(state: &Application, owner: RecordingOwner, pcm: Vec<f32>) -> Recording {
    let store = state.lock().unwrap();
    let scope = owner.scope(&store).unwrap();
    let visit = match &owner {
        RecordingOwner::DrillItem(id) => {
            Some(crate::drill::sessions::active_visit(&store.connection, id).unwrap())
        }
        _ => None,
    };
    Recording {
        id: "continuous-fixture".into(),
        install: store.snapshot().unwrap().learner.id,
        owner,
        visit,
        target: access::resolve(&store.connection, access::Capability::Transcription).unwrap(),
        language: scope.language,
        context: scope.context,
        capture: audio::fixture(pcm, 8000),
    }
}

#[cfg(all(test, desktop))]
#[path = "transcription_execution_tests.rs"]
mod tests;
