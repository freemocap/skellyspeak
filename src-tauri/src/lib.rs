pub mod ai;
pub mod sse;
pub mod persistence;
mod credentials;
mod network;
mod request_admission;
pub mod gate;
// The core records wherever the webview cannot: desktop AND iOS. WKWebView
// gives no `navigator.mediaDevices` under Tauri's custom scheme on macOS, and
// iOS has the same problem — only Android's webview offers the recorder, so
// only Android records in the webview.
#[cfg(any(desktop, target_os = "ios"))]
pub mod audio;
#[cfg(test)]
mod bench;
pub mod commands;
pub mod conversation;
pub mod conversation_partner;
pub mod graph;
mod hosted;
pub mod languages;
pub mod observer;
pub mod lesson;
pub mod personas;
pub mod ontology;
pub mod prompts;
mod settings;
pub mod turn_plan;
pub mod trace;
pub mod skills;
pub mod instruction;
mod trace_archive;
mod factory_reset;

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    /// Serializes context changes and rejects results from an earlier context.
    pub context_epoch: Mutex<u64>,
    pub observer_turns: Mutex<u64>,
    pub settings: Mutex<settings::Settings>,
    pub config_dir: std::path::PathBuf,
    pub plan: Mutex<observer::TeachingPlan>,
    pub profile: Mutex<observer::Profile>,
    pub recent_mechanics: Mutex<Vec<String>>,
    pub observer_running: Mutex<bool>,
    /// The private coach thread (Cyrano side-channel) — persisted.
    pub coach_thread: Mutex<Vec<commands::CoachChatMessage>>,
    pub coach_request: tokio::sync::Mutex<()>,
    /// Faults from before the webview existed. The UI drains this on mount so
    /// a startup problem reaches the screen instead of dying in a log file.
    pub startup_faults: Mutex<Vec<String>>,
    /// The recording in progress, if any. Desktop and iOS record in the core
    /// because WKWebView gives a packaged build no `navigator.mediaDevices`;
    /// Android records in the webview and never fills this.
    #[cfg(any(desktop, target_os = "ios"))]
    pub capture: Mutex<Option<audio::Capture>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut context = tauri::generate_context!();
    #[cfg(all(desktop, debug_assertions))]
    {
        context.config_mut().identifier = "com.freemocap.skellyspeak.dev".into();
    }
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();
    // Desktop only: Tauri ships no updater for Android or iOS, where updates
    // arrive through the store or a sideloaded package.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _arguments, _directory| {
                let window = app.get_webview_window("main").expect("Primary application window is missing");
                window.unminimize().expect("Could not restore the application window");
                window.show().expect("Could not show the application window");
                window.set_focus().expect("Could not focus the application window");
            }))
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
        .setup(|app| {
            // A stable configuration directory identifies preferences and their credential-vault entry.
            let config_dir = app
                .path()
                .app_config_dir()
                .map_err(|e| format!("could not resolve the app config dir: {e}"))?;
            if std::fs::symlink_metadata(&config_dir).is_ok_and(|m| m.file_type().is_symlink()) {
                return Err("Application config directory cannot be a symlink.".into());
            }
            std::fs::create_dir_all(&config_dir)
                .map_err(|e| format!("failed to create config dir: {e}"))?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&config_dir, std::fs::Permissions::from_mode(0o700))?;
            }
            let mut startup_faults: Vec<String> = Vec::new();
            credentials::initialize()?;
            factory_reset::complete(app.handle(), &config_dir)?;
            app.handle().plugin(
                tauri_plugin_log::Builder::new()
                    .targets([
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: Some("skellyspeak".into()) }),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                    ])
                    .level(log::LevelFilter::Info)
                    .max_file_size(2_000_000)
                    .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                    .build(),
            )?;
            log::info!("SkellySpeak starting (version {})", app.package_info().version);
            let loaded = settings::load_or_create(&config_dir);
            if let Some(fault) = loaded.fault {
                return Err(fault.into());
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
            let docs_dir = conversation::pair_dir(
                &config_dir,
                &settings.target_language,
                &settings.native_language,
            )?;
            let (plan, profile) = observer::load_documents(&docs_dir, &mut startup_faults);
            if !startup_faults.is_empty() { return Err(startup_faults.join("\n").into()); }
            log::info!(
                "documents loaded: focus_count={} profile_about_len={}",
                plan.session_focus.len(),
                profile.about.len(),
            );
            // Attach the trace bus: every AI run is recorded regardless, but
            // this is what lets the webview watch them live.
            trace::attach(app.handle().clone(), &config_dir).map_err(std::io::Error::other)?;
            // The pipeline gate, so pause/step state reaches every window.
            gate::attach(app.handle().clone());
            // The coach thread belongs to whichever chat is open in this pairing.
            let chat_dir = conversation::ensure_current_chat(&docs_dir)
                .and_then(|id| conversation::chat_dir(&docs_dir, &id))?;
            let coach_thread = commands::init_coach_thread(&chat_dir, &mut startup_faults);
            if !startup_faults.is_empty() { return Err(startup_faults.join("\n").into()); }
            log::info!("coach thread loaded: {} messages", coach_thread.len());
            app.manage(AppState {
                context_epoch: Mutex::new(0),
                observer_turns: Mutex::new(0),
                settings: Mutex::new(settings),
                config_dir,
                plan: Mutex::new(plan),
                profile: Mutex::new(profile),
                recent_mechanics: Mutex::new(Vec::new()),
                observer_running: Mutex::new(false),
                coach_thread: Mutex::new(coach_thread),
                coach_request: tokio::sync::Mutex::new(()),
                startup_faults: Mutex::new(startup_faults),
                #[cfg(any(desktop, target_os = "ios"))]
                capture: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_settings::get_settings,
            commands::app_settings::get_update_channel,
            commands::app_settings::latest_github_release,
            commands::app_settings::reset_settings,
            factory_reset::factory_reset,
            commands::app_settings::save_settings,
            commands::app_settings::take_startup_faults,
            commands::coach::coach_ask,
            commands::lesson::get_lesson,
            commands::lesson::lesson_topic_note,
            commands::lesson::save_lesson,
            commands::personas::get_conversation_partner,
            commands::personas::reroll_persona,
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
            commands::dev::get_trace_retention,
            commands::dev::export_runs,
            commands::dev::open_dev_window,
            commands::guided::guided_turn,
            commands::skills::get_skill_evidence,
            commands::skills::get_practice_overview,
            commands::skills::save_skill_profile,
            commands::hosted_auth::hosted_account,
            commands::hosted_auth::hosted_sign_in,
            commands::hosted_auth::hosted_sign_out,
            commands::insight::word_insight,
            commands::insight::annotate_text,
            commands::keys::validate_key,
            commands::personas::delete_persona,
            commands::personas::list_personas,
            commands::personas::save_persona,
            commands::pipeline::gate_pause,
            commands::pipeline::gate_resume,
            commands::pipeline::gate_status,
            commands::pipeline::gate_step,
            commands::mic::mic_cancel,
            commands::mic::mic_devices,
            commands::mic::mic_native,
            commands::mic::mic_start,
            commands::mic::mic_stop,
            commands::mic::mic_wave,
            commands::scaffolds::generate_scaffolds,
            commands::stt::transcribe_audio,
            commands::tts::speak_text,
        ])
        .run(context)
        .expect("error while running SkellySpeak");
}
