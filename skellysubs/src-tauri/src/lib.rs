// Vendored from Handy (github.com/cjpais/Handy, MIT): capture/VAD/transcription/
// model machinery. Dictation-specific glue (actions/shortcut/tray/clipboard) is
// deliberately NOT vendored — we replace it with our own coordinator.

pub mod audio_toolkit;
pub mod catalog;
pub mod commands;
pub mod helpers;
pub mod llm_client;
pub mod managers;
pub mod portable;
pub mod provider_settings;
pub mod settings;
pub mod stt;
pub mod transcription_adapter;
pub mod utils;

use tauri::Manager;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .setup(|app| -> Result<(), Box<dyn std::error::Error>> {
            let handle = app.handle().clone();

            let model_manager = std::sync::Arc::new(managers::model::ModelManager::new(&handle)?);
            let transcription = std::sync::Arc::new(
                managers::transcription::TranscriptionManager::new(&handle, model_manager.clone())?,
            );
            let audio = std::sync::Arc::new(managers::audio::AudioRecordingManager::new(
                &handle,
                transcription.stream_router(),
            )?);

            app.manage(model_manager);
            app.manage(transcription);
            app.manage(audio);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::send_message,
            commands::start_listening,
            commands::stop_listening,
            commands::stt_status,
            commands::ensure_stt_model,
            provider_settings::get_provider_settings,
            provider_settings::set_provider_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
