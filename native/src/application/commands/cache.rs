use super::*;
use crate::ai::results::{self, CacheSettings};

#[tauri::command]
pub(in crate::application) fn get_inference_cache_settings(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<CacheSettings> {
    results::settings(&state.lock()?.connection)
}
#[tauri::command]
pub(in crate::application) fn save_inference_cache_settings(
    state: tauri::State<'_, Arc<Application>>,
    capacity_bytes: u64,
) -> Result<CacheSettings> {
    results::set_capacity(&state.lock()?.connection, capacity_bytes)
}
