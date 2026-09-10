use crate::model::{AppError, ErrorCode, Result};
fn unavailable() -> AppError {
    AppError::new(
        ErrorCode::Provider,
        "Mobile microphone integration is not available in this build.",
    )
}
#[tauri::command]
pub fn mic_start(conversation_id: String) -> Result<String> {
    let _ = conversation_id;
    Err(unavailable())
}
#[tauri::command]
pub fn mic_wave(recording_id: String) -> Result<Vec<f32>> {
    let _ = recording_id;
    Err(unavailable())
}
#[tauri::command]
pub fn mic_cancel(recording_id: String) -> Result<()> {
    let _ = recording_id;
    Err(unavailable())
}
#[tauri::command]
pub fn mic_transcribe(recording_id: String) -> Result<String> {
    let _ = recording_id;
    Err(unavailable())
}
