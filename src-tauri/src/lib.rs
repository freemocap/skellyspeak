pub mod ai;
#[cfg(test)]
mod bench;
pub mod commands;
pub mod conversation;
pub mod graph;
mod hosted;
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
    // Mobile only: sign-in returns through a `skellyspeak://` deep link,
    // because there is no loopback listener to come back to on a phone.
    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_deep_link::init());
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
                "settings loaded: target={}, native={}, model={}, observer_model={}, provider={}, hosted_session={}, openrouter_key={}, groq_key={}",
                settings.target_language,
                settings.native_language,
                settings.openrouter_model,
                settings.observer_model.as_deref().unwrap_or("(same as tutor)"),
                settings.provider_mode,
                // Whether there is one, never any part of it.
                if settings.hosted_token.is_empty() { "signed out" } else { "signed in" },
                if settings.openrouter_key.is_empty() { "MISSING" } else { "set" },
                if settings.groq_key.is_empty() { "MISSING" } else { "set" },
            );
            // Documents live under the current pairing, so switching language
            // leaves the other conversation intact rather than archiving it.
            let docs_dir = match conversation::pair_dir(
                &config_dir,
                &settings.target_language,
                &settings.native_language,
            ) {
                Ok(dir) => dir,
                Err(e) => {
                    // Nothing can be remembered without it, so say so loudly
                    // and fall back to no conversation rather than crashing.
                    startup_faults.push(format!(
                        "{e} Nothing from this conversation will be saved."
                    ));
                    config_dir.clone()
                }
            };
            let (plan, profile) = observer::load_documents(&docs_dir, &mut startup_faults);
            log::info!(
                "documents loaded: focus={:?} profile_about_len={}",
                plan.session_focus,
                profile.about.len(),
            );
            // Attach the trace bus: every AI run is recorded regardless, but
            // this is what lets the webview watch them live.
            trace::attach(app.handle().clone());
            // The coach thread belongs to whichever chat is open in this pairing.
            let chat_dir = conversation::ensure_current_chat(&docs_dir)
                .and_then(|id| conversation::chat_dir(&docs_dir, &id))
                .unwrap_or_else(|e| {
                    startup_faults.push(format!("{e} This conversation will not be saved."));
                    docs_dir.clone()
                });
            let coach_thread = commands::init_coach_thread(&chat_dir, &mut startup_faults);
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
            commands::app_settings::get_settings,
            commands::app_settings::latest_github_release,
            commands::app_settings::reset_settings,
            commands::app_settings::save_settings,
            commands::app_settings::take_startup_faults,
            commands::coach::coach_ask,
            commands::coach::coach_thread_clear,
            commands::coach::get_coach_thread,
            commands::conversations::delete_conversation,
            commands::conversations::get_plan,
            commands::conversations::list_conversations,
            commands::conversations::load_conversation,
            commands::conversations::new_conversation,
            commands::conversations::open_conversation,
            commands::conversations::save_conversation,
            commands::dev::clear_runs,
            commands::dev::get_diagnostics,
            commands::dev::get_graph,
            commands::dev::get_languages,
            commands::dev::get_reconciliation,
            commands::dev::get_runs,
            commands::dev::open_dev_window,
            commands::guided::guided_turn,
            commands::hosted_auth::hosted_account,
            commands::hosted_auth::hosted_sign_in,
            commands::hosted_auth::hosted_sign_out,
            commands::insight::word_insight,
            commands::keys::validate_key,
            commands::scaffolds::generate_scaffolds,
            commands::stories::generate_story,
            commands::stt::transcribe_audio,
            commands::tts::speak_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running SkellySpeak");
}
