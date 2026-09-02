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
    /// Faults from before the webview existed. The UI drains this on mount so
    /// a startup problem reaches the screen instead of dying in a log file.
    pub startup_faults: Mutex<Vec<String>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();
    // Desktop only: Tauri ships no updater for Android or iOS, where updates
    // arrive through the store or a sideloaded package.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }
    builder
        .plugin(tauri_plugin_opener::init())
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
            // No fallback to a temp dir: settings.json holds the user's API
            // keys, and a temp directory is wiped out from under them. If the
            // OS cannot tell us where config lives, refuse to start rather
            // than write secrets somewhere that silently loses them.
            let config_dir = app
                .path()
                .app_config_dir()
                .map_err(|e| format!("could not resolve the app config dir: {e}"))?;
            log::info!("config dir: {}", config_dir.display());
            std::fs::create_dir_all(&config_dir)
                .map_err(|e| format!("failed to create config dir: {e}"))?;
            let mut startup_faults: Vec<String> = Vec::new();
            let loaded = settings::load_or_create(&config_dir);
            if let Some(fault) = loaded.fault {
                startup_faults.push(fault);
            }
            let settings = loaded.settings;
            log::info!(
                "settings loaded: target={}, native={}, model={}, observer_model={}, openrouter_key={}, groq_key={}",
                settings.target_language,
                settings.native_language,
                settings.openrouter_model,
                settings.observer_model.as_deref().unwrap_or("(same as tutor)"),
                if settings.openrouter_key.is_empty() { "MISSING" } else { "set" },
                if settings.groq_key.is_empty() { "MISSING" } else { "set" },
            );
            let (plan, profile) = observer::load_documents(&config_dir, &mut startup_faults);
            log::info!(
                "documents loaded: focus={:?} profile_about_len={}",
                plan.session_focus,
                profile.about.len(),
            );
            // Attach the trace bus: every AI run is recorded regardless, but
            // this is what lets the webview watch them live.
            trace::attach(app.handle().clone());
            let coach_thread = commands::init_coach_thread(&config_dir, &mut startup_faults);
            log::info!("coach thread loaded: {} messages", coach_thread.len());
            app.manage(AppState {
                settings: Mutex::new(settings),
                config_dir,
                plan: Mutex::new(plan),
                profile: Mutex::new(profile),
                recent_mechanics: Mutex::new(Vec::new()),
                observer_running: Mutex::new(false),
                coach_thread: Mutex::new(coach_thread),
                startup_faults: Mutex::new(startup_faults),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::reset_settings,
            commands::take_startup_faults,
            commands::latest_github_release,
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
