use super::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());
    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_deep_link::init());
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .on_menu_event(|app, event| {
            let action = if event.id() == "reading-size-increase" {
                Some("increase")
            } else if event.id() == "reading-size-decrease" {
                Some("decrease")
            } else if event.id() == "reading-size-reset" {
                Some("reset")
            } else {
                None
            };
            if let Some(action) = action
                && let Err(error) = app.emit("reading-size-action", action)
            {
                eprintln!("Unable to deliver reading-size menu action: {error}");
            }
        });
    builder
        .setup(|app| {
            #[cfg(desktop)]
            {
                let app_menu = SubmenuBuilder::new(app, "SkellySpeak")
                    .about(None)
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .separator()
                    .quit()
                    .build()?;
                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;
                let view_menu = SubmenuBuilder::new(app, "View")
                    .item(
                        &MenuItemBuilder::with_id("reading-size-increase", "Increase Font Size")
                            .accelerator("CmdOrCtrl+=")
                            .build(app)?,
                    )
                    .item(
                        &MenuItemBuilder::with_id("reading-size-decrease", "Decrease Font Size")
                            .accelerator("CmdOrCtrl+-")
                            .build(app)?,
                    )
                    .item(
                        &MenuItemBuilder::with_id("reading-size-reset", "Reset Font Size")
                            .accelerator("CmdOrCtrl+0")
                            .build(app)?,
                    )
                    .build()?;
                let window_menu = SubmenuBuilder::new(app, "Window")
                    .minimize()
                    .close_window()
                    .build()?;
                app.set_menu(
                    MenuBuilder::new(app)
                        .items(&[&app_menu, &edit_menu, &view_menu, &window_menu])
                        .build()?,
                )?;
            }
            let directory = app.path().app_data_dir()?;
            store::prepare_private_directory(&directory)?;
            // A previous reset may have left the log directory to clear. That has to
            // happen before the log sink below opens a file inside it.
            // Android/iOS use a subdirectory of app data: it is private, writable,
            // and available before the webview starts. Desktop retains the platform
            // log directory (or the development repository sink) in diagnostics.
            #[cfg(any(target_os = "android", target_os = "ios"))]
            let diagnostics_root = directory.join("logs");
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            let diagnostics_root = app.path().app_log_dir()?;
            let cleanup = factory_reset::finish_pending(
                &directory,
                &diagnostics::configured_root(&diagnostics_root)?,
            )
            .err();
            diagnostics::initialize(&diagnostics_root)?;
            let state = Application::start(&directory.join(store::WORKSPACE_FILE), cleanup);
            // A refused workspace has nothing to clean or prepare; the window still
            // opens, the reason reaches the screen, and the reset stays reachable.
            if state.refusal().is_none() {
                state.recover_credential_cleanup_with(credentials::remove)?;
                state.lock()?.prepare_chat()?;
            }
            app.manage(state.clone());
            tauri::async_runtime::spawn(scheduler(state.clone(), app.handle().clone()));
            tauri::async_runtime::spawn(streams::stream_pump(state, app.handle().clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            updater::get_update_channel,
            updater::latest_github_release,
            commands::workspace::read_speech_audio,
            diagnostics::record_frontend_diagnostic,
            diagnostics::read_frontend_diagnostics,
            voice::mic_start,
            voice::mic_wave,
            voice::mic_cancel,
            voice::mic_transcribe,
            factory_reset::factory_reset,
            factory_reset::export_workspace,
            commands::workspace::get_startup_state,
            commands::workspace::retry_credential_cleanup,
            commands::workspace::get_snapshot,
            commands::workspace::preview_conversation_prompt,
            commands::workspace::inspect_language,
            commands::workspace::execute_command,
            access::get_access_settings,
            access::save_access_settings,
            access::check_access,
            commands::local_server::local_server_available,
            commands::local_server::connect_local_server,
            commands::connections::get_connection,
            commands::connections::save_connection,
            commands::connections::save_models,
            commands::connections::verify_openrouter_key,
            commands::connections::disconnect,
            commands::workspace::watch_conversation,
            commands::partners::begin_persona_generation,
            commands::partners::run_persona_generation,
            commands::partners::cancel_persona_generation,
            commands::hosted::hosted_sign_in,
            commands::hosted::hosted_account,
            commands::hosted::hosted_diagnostics,
            commands::hosted::hosted_sign_out,
            commands::hosted::cancel_sign_in,
            commands::connections::select_route,
            commands::workspace::get_profile,
            commands::partners::get_persona_generation_activity,
            progression::get_skill_evidence,
            learner_state::get_learner_state,
            learner_state::get_learner_profile,
            rewards::claim_reward_events,
            learner_state::export_learner_state,
            learner_state::save_learner_state,
            conversation_export::view_conversation_yaml,
            conversation_export::save_conversation_yaml,
            reward_settings::get_reward_settings,
            reward_settings::get_playback_rate,
            reward_settings::save_playback_rate,
            reward_settings::save_reward_settings,
            progression::save_skill_profile,
            progression::get_practice_overview,
            commands::workspace::open_ai_window,
            commands::workspace::list_turn_history,
            commands::workspace::get_attempt_detail,
            commands::workspace::read_attempt_streams,
            commands::workspace::ai_window_state,
            commands::workspace::dock_ai_window,
            commands::workspace::set_ai_view_selection,
            commands::workspace::get_ai_view_selection,
            commands::workspace::get_ai_graph_definitions,
        ])
        .run(tauri::generate_context!())
        .expect("SkellySpeak could not start; no reset or fallback was performed");
}
