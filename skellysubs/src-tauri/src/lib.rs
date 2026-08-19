// Vendored from Handy (github.com/cjpais/Handy, MIT): capture/VAD/transcription/
// model machinery. Dictation-specific glue (actions/shortcut/tray/clipboard) is
// deliberately NOT vendored — we replace it with our own coordinator.

pub mod audio_toolkit;
pub mod catalog;
pub mod helpers;
pub mod llm_client;
pub mod managers;
pub mod portable;
pub mod settings;
pub mod transcription_adapter;
pub mod utils;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
