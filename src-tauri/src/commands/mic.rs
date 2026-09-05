//! Microphone commands.
//!
//! Android records in the webview, where `navigator.mediaDevices` exists;
//! every other platform records in the core (see `crate::audio`), because
//! WKWebView gives neither macOS nor iOS a webview recorder. `mic_native` is
//! how the UI knows which of the two it is talking to — it is a compile-time
//! fact, not a probe, so there is nothing to get out of step.

use tauri::State;

use crate::AppState;

/// Does the core do the recording on this platform?
///
/// True on desktop and iOS. False on Android, where the webview recorder is
/// used and every other command in this module refuses.
#[tauri::command]
pub fn mic_native() -> bool {
    cfg!(any(desktop, target_os = "ios"))
}

/// Input devices the core can open, by name.
#[tauri::command]
pub fn mic_devices() -> Result<Vec<String>, String> {
    #[cfg(any(desktop, target_os = "ios"))]
    {
        crate::audio::devices()
    }
    #[cfg(not(any(desktop, target_os = "ios")))]
    {
        Err(NOT_NATIVE.into())
    }
}

/// Begin recording. `device` is a name from `mic_devices`, or null for the
/// system default.
///
/// Returns how many waveform samples a second `mic_wave` will produce, which
/// the UI needs to scale its time axis.
#[tauri::command]
pub fn mic_start(state: State<'_, AppState>, device: Option<String>) -> Result<f32, String> {
    #[cfg(any(desktop, target_os = "ios"))]
    {
        let mut slot = state.capture.lock().unwrap_or_else(|p| p.into_inner());
        if slot.is_some() {
            return Err("A recording is already running.".into());
        }
        let capture = crate::audio::start(device.as_deref())?;
        let rate = capture.wave_rate();
        *slot = Some(capture);
        Ok(rate)
    }
    #[cfg(not(any(desktop, target_os = "ios")))]
    {
        let _ = (state, device);
        Err(NOT_NATIVE.into())
    }
}

/// Waveform samples captured since the last call, in -1..1.
///
/// Returns an empty list when nothing is recording, which is what the UI wants
/// on the poll that races a stop.
#[tauri::command]
pub fn mic_wave(state: State<'_, AppState>) -> Vec<f32> {
    #[cfg(any(desktop, target_os = "ios"))]
    {
        let slot = state.capture.lock().unwrap_or_else(|p| p.into_inner());
        slot.as_ref().map(|c| c.take_wave()).unwrap_or_default()
    }
    #[cfg(not(any(desktop, target_os = "ios")))]
    {
        let _ = state;
        Vec::new()
    }
}

/// Stop recording and hand back the WAV, base64 encoded for the IPC boundary.
#[tauri::command]
pub fn mic_stop(state: State<'_, AppState>) -> Result<String, String> {
    #[cfg(any(desktop, target_os = "ios"))]
    {
        use base64::Engine;
        let capture = state
            .capture
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .take()
            .ok_or("Nothing was recording.")?;
        let wav = capture.finish()?;
        Ok(base64::engine::general_purpose::STANDARD.encode(wav))
    }
    #[cfg(not(any(desktop, target_os = "ios")))]
    {
        let _ = state;
        Err(NOT_NATIVE.into())
    }
}

/// Stop recording and throw the audio away. Safe to call when nothing is
/// running — cancelling twice is not a failure.
#[tauri::command]
pub fn mic_cancel(state: State<'_, AppState>) {
    #[cfg(any(desktop, target_os = "ios"))]
    {
        if let Some(capture) = state
            .capture
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .take()
        {
            capture.discard();
        }
    }
    #[cfg(not(any(desktop, target_os = "ios")))]
    {
        let _ = state;
    }
}

#[cfg(not(any(desktop, target_os = "ios")))]
const NOT_NATIVE: &str =
    "This platform records in the webview, so the core has no microphone to offer.";
