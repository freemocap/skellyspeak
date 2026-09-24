//! The microphone this device records from. The choice belongs to the machine,
//! not the learner: device names and browser device ids mean nothing elsewhere.
//!
//! Desktop records through cpal, so the stored value is a cpal device name.
//! Mobile records in the webview, so it is a `MediaDeviceInfo.deviceId` the
//! webview listed. `list_microphones` states which of the two applies here.
//! A missing device is an error when recording starts, never a silent switch to
//! the system default.
use crate::application::Application;
use crate::model::*;
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use ts_rs::TS;

const MAX_DEVICE_LENGTH: usize = 512;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MicrophoneSource {
    // Devices are listed and opened natively; `devices` is filled.
    Native,
    // The webview records; the UI lists devices through the browser API.
    Browser,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MicrophoneDevice {
    // The value stored when this device is selected.
    pub id: String,
    pub label: String,
    pub is_default: bool,
    // The format capture would open with; absent when the device would not report one.
    pub channels: Option<u16>,
    pub sample_rate: Option<u32>,
    // Why the format is absent, as the audio system reported it.
    pub unavailable: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MicrophoneList {
    pub source: MicrophoneSource,
    pub devices: Vec<MicrophoneDevice>,
}

pub fn initialize(db: &Connection) -> Result<()> {
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS microphone_selection(singleton INTEGER PRIMARY KEY CHECK(singleton=1), device TEXT CHECK(device IS NULL OR length(device) BETWEEN 1 AND 512)); INSERT OR IGNORE INTO microphone_selection VALUES(1,NULL);",
    )?;
    Ok(())
}

/// The selected device, or `None` for the system default.
pub(crate) fn selected(db: &Connection) -> Result<Option<String>> {
    Ok(db
        .query_row(
            "SELECT device FROM microphone_selection WHERE singleton=1",
            [],
            |r| r.get::<_, Option<String>>(0),
        )
        .optional()?
        .flatten())
}

fn select(db: &Connection, device: Option<String>) -> Result<()> {
    if device
        .as_ref()
        .is_some_and(|d| d.is_empty() || d.len() > MAX_DEVICE_LENGTH)
    {
        return Err(AppError::new(
            ErrorCode::Validation,
            "A microphone must be named, in at most 512 bytes. Choose System default to clear it.",
        ));
    }
    db.execute(
        "UPDATE microphone_selection SET device=?1 WHERE singleton=1",
        [device],
    )?;
    Ok(())
}

#[tauri::command]
pub(crate) fn get_microphone(state: tauri::State<'_, Arc<Application>>) -> Result<Option<String>> {
    selected(&state.lock()?.connection)
}

#[tauri::command]
pub(crate) fn save_microphone(
    state: tauri::State<'_, Arc<Application>>,
    device: Option<String>,
) -> Result<()> {
    select(&state.lock()?.connection, device)
}

#[tauri::command]
pub(crate) async fn list_microphones() -> Result<MicrophoneList> {
    #[cfg(desktop)]
    {
        tauri::async_runtime::spawn_blocking(|| {
            super::audio::input_devices().map(|devices| MicrophoneList {
                source: MicrophoneSource::Native,
                devices,
            })
        })
        .await
        .map_err(|cause| {
            crate::diagnostics::failures::join(
                &cause,
                "microphone.rs",
                AppError::new(
                    ErrorCode::Provider,
                    "Listing microphones stopped unexpectedly.",
                ),
            )
        })?
        .map_err(|message| AppError::new(ErrorCode::Provider, message))
    }
    #[cfg(mobile)]
    {
        Ok(MicrophoneList {
            source: MicrophoneSource::Browser,
            devices: vec![],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn selection_survives_reopening_and_rejects_empty_or_oversized_names() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("microphone.db");
        let db = Connection::open(&path).unwrap();
        initialize(&db).unwrap();
        assert_eq!(selected(&db).unwrap(), None);
        select(&db, Some("Microphone (Yeti X)".into())).unwrap();
        drop(db);
        let db = Connection::open(&path).unwrap();
        initialize(&db).unwrap();
        assert_eq!(
            selected(&db).unwrap().as_deref(),
            Some("Microphone (Yeti X)")
        );
        assert!(select(&db, Some(String::new())).is_err());
        assert!(select(&db, Some("x".repeat(513))).is_err());
        assert_eq!(
            selected(&db).unwrap().as_deref(),
            Some("Microphone (Yeti X)")
        );
        select(&db, None).unwrap();
        assert_eq!(selected(&db).unwrap(), None);
    }
}
