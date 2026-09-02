pub mod ai;
#[cfg(test)]
mod bench;
pub mod commands;
pub mod graph;
pub mod languages;
pub mod observer;
pub mod ontology;
pub mod prompts;
mod settings;
pub mod turn_plan;
pub mod trace;

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub settings: Mutex<settings::Settings>,
    pub config_dir: std::path::PathBuf,
    pub plan: Mutex<observer::TeachingPlan>,
    pub profile: Mutex<observer::Profile>,
    pub recent_mechanics: Mutex<Vec<String>>,
    pub observer_running: Mutex<bool>,
    /// The private coach thread (Cyrano side-channel) — persisted.
    pub coach_thread: Mutex<Vec<commands::CoachChatMessage>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    tauri_plugin_log::Target::new(
                        tauri_plugin_log::TargetKind::LogDir { file_name: Some("skellyspeak".into()) },
                    ),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                ])
                .level(log::LevelFilter::Debug)
                .max_file_size(2_000_000)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .build(),
        )
        .setup(|app| {
            log::info!("SkellySpeak starting (version {})", app.package_info().version);
            let config_dir = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| std::env::temp_dir().join("skellyspeak"));
            log::info!("config dir: {}", config_dir.display());
            std::fs::create_dir_all(&config_dir)
                .map_err(|e| format!("failed to create config dir: {e}"))?;
            let settings = settings::load_or_create(&config_dir);
            log::info!(
                "settings loaded: target={}, native={}, model={}, observer_model={}, openrouter_key={}, groq_key={}",
                settings.target_language,
                settings.native_language,
                settings.openrouter_model,
                settings.observer_model.as_deref().unwrap_or("(same as tutor)"),
                if settings.openrouter_key.is_empty() { "MISSING" } else { "set" },
                if settings.groq_key.is_empty() { "MISSING" } else { "set" },
            );
            let (plan, profile) = observer::load_documents(&config_dir);
            log::info!(
                "documents loaded: focus={:?} profile_about_len={}",
                plan.session_focus,
                profile.about.len(),
            );
            // Attach the trace bus: every AI run is recorded regardless, but
            // this is what lets the webview watch them live.
            trace::attach(app.handle().clone());
            let coach_thread = commands::init_coach_thread(&config_dir);
            log::info!("coach thread loaded: {} messages", coach_thread.len());
            app.manage(AppState {
                settings: Mutex::new(settings),
                config_dir,
                plan: Mutex::new(plan),
                profile: Mutex::new(profile),
                recent_mechanics: Mutex::new(Vec::new()),
                observer_running: Mutex::new(false),
                coach_thread: Mutex::new(coach_thread),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::validate_key,
            commands::get_languages,
            commands::open_dev_window,
            commands::get_graph,
            commands::get_reconciliation,
            commands::get_runs,
            commands::clear_runs,
            commands::get_diagnostics,
            commands::speak_text,
            commands::generate_scaffolds,
            commands::word_insight,
            commands::get_coach_thread,
            commands::coach_ask,
            commands::coach_thread_clear,
            commands::guided_turn,
            commands::generate_story,
            commands::transcribe_audio,
            commands::get_plan,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SkellySpeak");
}
