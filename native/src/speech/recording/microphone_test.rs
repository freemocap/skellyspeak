//! Local, bounded microphone checks. No conversation, AI route or audio persistence.
use crate::application::Application;
use crate::model::{AppError, ErrorCode, Result};
use serde::Serialize;
use std::sync::Arc;
use ts_rs::TS;

pub(crate) struct Session {
    id: String,
    #[cfg(desktop)]
    capture: super::audio::Capture,
}

#[derive(Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MicrophoneTestStarted {
    browser_capture: bool,
    device_label: Option<String>,
}

fn fault(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::Provider, message)
}

pub(super) fn require_idle(slot: &Option<Session>) -> Result<()> {
    if slot.is_some() {
        return Err(fault("Stop the microphone test before recording."));
    }
    Ok(())
}

fn stop(state: &Application, id: &str) -> Result<()> {
    let mut slot = state
        .microphone_test
        .lock()
        .map_err(|_| fault("Microphone test state unavailable."))?;
    if slot.as_ref().is_some_and(|session| session.id == id) {
        slot.take();
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn microphone_test_start(
    state: tauri::State<'_, Arc<Application>>,
    test_id: String,
    device: Option<String>,
) -> Result<MicrophoneTestStarted> {
    uuid::Uuid::parse_str(&test_id).map_err(|_| fault("Invalid microphone test identity."))?;
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        // Every capture start takes these locks in this order.
        let mut test = state
            .microphone_test
            .lock()
            .map_err(|_| fault("Microphone test state unavailable."))?;
        require_idle(&test)?;
        let recording = state
            .capture
            .lock()
            .map_err(|_| fault("Microphone state unavailable."))?;
        if recording.is_some() {
            return Err(fault("Stop recording before testing the microphone."));
        }
        #[cfg(desktop)]
        let capture = super::audio::start(device.as_deref()).map_err(fault)?;
        #[cfg(mobile)]
        let _ = device;
        let started = MicrophoneTestStarted {
            browser_capture: cfg!(mobile),
            #[cfg(desktop)]
            device_label: Some(capture.device_label().to_owned()),
            #[cfg(mobile)]
            device_label: None,
        };
        *test = Some(Session {
            id: test_id.clone(),
            #[cfg(desktop)]
            capture,
        });
        // Native safety bound also applies if the webview disappears.
        let expiry = state.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs(20)).await;
            if let Err(error) = stop(&expiry, &test_id) {
                crate::diagnostics::failures::report("microphone_test_expiry", &error);
            }
        });
        Ok(started)
    })
    .await
    .map_err(|cause| {
        crate::diagnostics::failures::join(
            &cause,
            "microphone_test.rs",
            fault("Microphone test startup stopped unexpectedly."),
        )
    })?
}

#[tauri::command]
pub(crate) fn microphone_test_samples(
    state: tauri::State<'_, Arc<Application>>,
    test_id: String,
) -> Result<Vec<f32>> {
    let slot = state
        .microphone_test
        .lock()
        .map_err(|_| fault("Microphone test state unavailable."))?;
    let session = slot
        .as_ref()
        .filter(|session| session.id == test_id)
        .ok_or_else(|| fault("Microphone test has ended."))?;
    #[cfg(desktop)]
    {
        session
            .capture
            .drain()
            .map(|(_, samples)| samples)
            .map_err(fault)
    }
    #[cfg(mobile)]
    {
        let _ = session;
        Err(fault("Microphone samples are supplied by the browser."))
    }
}

#[tauri::command]
pub(crate) fn microphone_test_stop(
    state: tauri::State<'_, Arc<Application>>,
    test_id: String,
) -> Result<()> {
    stop(&state, &test_id)
}
