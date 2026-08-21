//! Provider settings persistence (LLM + STT local/remote) via tauri-plugin-store.

use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

use skellysubs_core::ProviderSettings;

const STORE_PATH: &str = "providers_store.json";
const KEY: &str = "providers";

pub fn load(app: &AppHandle) -> Result<ProviderSettings, String> {
    let store = app
        .store(crate::portable::store_path(STORE_PATH))
        .map_err(|e| e.to_string())?;
    match store.get(KEY) {
        Some(v) => serde_json::from_value(v).map_err(|e| format!("bad provider settings: {e}")),
        None => Ok(ProviderSettings::default()),
    }
}

pub fn save(app: &AppHandle, settings: &ProviderSettings) -> Result<(), String> {
    let store = app
        .store(crate::portable::store_path(STORE_PATH))
        .map_err(|e| e.to_string())?;
    let value = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    store.set(KEY, value);
    Ok(())
}

#[tauri::command]
pub fn get_provider_settings(app: AppHandle) -> Result<ProviderSettings, String> {
    load(&app)
}

#[tauri::command]
pub fn set_provider_settings(app: AppHandle, settings: ProviderSettings) -> Result<(), String> {
    save(&app, &settings)
}
