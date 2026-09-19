use super::*;

/// Ordered operating-system preferences, read without changing device settings.
#[tauri::command]
pub(in crate::application) fn preferred_languages() -> Vec<String> {
    sys_locale::get_locales().collect()
}

/// Why the workspace could not be opened, or null when it opened. This is the one
/// command that answers before any store exists, so the window can always report
/// a refusal instead of failing every call with a generic error.
#[tauri::command]
pub(in crate::application) fn get_startup_state(
    state: tauri::State<'_, Arc<Application>>,
) -> StartupState {
    state.startup_state()
}

#[tauri::command]
pub(in crate::application) async fn retry_credential_cleanup(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<StartupState> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        state.recover_credential_cleanup_with(credentials::remove)
    })
    .await
    .map_err(|_| internal())?
}

#[tauri::command]
pub(in crate::application) fn get_snapshot(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<Snapshot> {
    state.lock()?.snapshot()
}

#[tauri::command]
pub(in crate::application) fn execute_command(
    state: tauri::State<'_, Arc<Application>>,
    command: Command,
) -> Result<Receipt> {
    state.lock()?.execute(command)
}

#[tauri::command]
pub(in crate::application) fn read_speech_audio(
    state: tauri::State<'_, Arc<Application>>,
    session_id: String,
    operation_id: String,
) -> Result<model::SpeechAudioState> {
    let store = state.lock()?;
    if session_id != store.session_id {
        return Err(AppError::new(
            ErrorCode::SessionExpired,
            "The application session changed. Refresh before continuing.",
        ));
    }
    store.speech_audio(&operation_id, &store.speech_cache)
}

#[tauri::command]
pub(in crate::application) fn get_profile(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<ProfileSnapshot> {
    state.lock()?.profile()
}

#[tauri::command]
pub(in crate::application) async fn open_ai_window(app: tauri::AppHandle) -> Result<()> {
    if let Some(window) = app.get_webview_window("ai") {
        window.show().map_err(|_| internal())?;
        window.set_focus().map_err(|_| internal())?;
    } else {
        let window = tauri::WebviewWindowBuilder::new(
            &app,
            "ai",
            tauri::WebviewUrl::App("index.html?view=ai".into()),
        )
        .title("SkellySpeak · AI activity")
        .inner_size(1000.0, 700.0)
        .min_inner_size(380.0, 400.0)
        .build()
        .map_err(|_| AppError::new(ErrorCode::Internal, "Could not open the AI window."))?;
        // The main window re-reads the window state on this hint; it never
        // trusts the event alone, so a missed event cannot leave it stale.
        let handle = app.clone();
        window.on_window_event(move |event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let _ = handle.emit_to("main", "ai-window-changed", ());
            }
        });
    }
    let _ = app.emit_to("main", "ai-window-changed", ());
    Ok(())
}

/// Whether this build can pop the AI View out, and whether its window exists.
/// The authoritative answer the main window reconciles against, after reloads
/// and missed events alike.
#[tauri::command]
pub(in crate::application) fn ai_window_state(
    app: tauri::AppHandle,
) -> crate::model::AiWindowState {
    crate::model::AiWindowState {
        supported: cfg!(desktop),
        open: app.get_webview_window("ai").is_some(),
    }
}

/// Pop the AI View back into the main window: tell the main window to show
/// its panel, then close the separate window.
#[tauri::command]
pub(in crate::application) async fn dock_ai_window(app: tauri::AppHandle) -> Result<()> {
    app.emit_to("main", "ai-view-docked", ()).map_err(|_| {
        AppError::new(
            ErrorCode::Internal,
            "Could not return the AI View to the main window.",
        )
    })?;
    if let Some(window) = app.get_webview_window("ai") {
        window
            .close()
            .map_err(|_| AppError::new(ErrorCode::Internal, "Could not close the AI window."))?;
    }
    Ok(())
}

#[tauri::command]
pub(in crate::application) fn set_ai_view_selection(
    state: tauri::State<'_, Arc<Application>>,
    selection: Option<crate::model::AiViewSelection>,
) -> Result<()> {
    *state.ai_view_selection.lock().map_err(|_| internal())? = selection;
    Ok(())
}

#[tauri::command]
pub(in crate::application) fn get_ai_view_selection(
    state: tauri::State<'_, Arc<Application>>,
) -> Result<Option<crate::model::AiViewSelection>> {
    Ok(state
        .ai_view_selection
        .lock()
        .map_err(|_| internal())?
        .clone())
}

/// The request and response recorded for one attempt, for inspection.
#[tauri::command]
pub(in crate::application) fn get_attempt_detail(
    state: tauri::State<'_, Arc<Application>>,
    attempt_id: String,
) -> Result<crate::model::AttemptDetail> {
    state.lock()?.attempt_detail(&attempt_id)
}

/// The current text of every streaming attempt in a conversation, for windows
/// that open or reload mid-stream.
#[tauri::command]
pub(in crate::application) fn read_attempt_streams(
    state: tauri::State<'_, Arc<Application>>,
    conversation_id: String,
) -> Result<crate::model::AttemptStreamRead> {
    state.read_streams(&conversation_id)
}

/// Older turns of one conversation, keyed by turn so the AI View's history
/// reaches every recorded turn.
#[tauri::command]
pub(in crate::application) fn list_turn_history(
    state: tauri::State<'_, Arc<Application>>,
    conversation_id: String,
    before: Option<String>,
    limit: u32,
) -> Result<crate::model::TurnHistoryPage> {
    state
        .lock()?
        .turn_history(&conversation_id, before.as_deref(), limit)
}

/// Conditional full snapshots combine observation and hydration without an event gap.
#[tauri::command]
pub(in crate::application) async fn watch_conversation(
    state: tauri::State<'_, Arc<Application>>,
    conversation_id: String,
    after_revision: i32,
    before: Option<i32>,
) -> Result<ConversationSnapshot> {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(20);
    loop {
        if let Some(snapshot) = state.lock()?.conversation_snapshot_since(
            &conversation_id,
            before,
            after_revision,
            tokio::time::Instant::now() >= deadline,
        )? {
            return Ok(snapshot);
        }
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
}

/// Inspect bundled teaching content without mutating learner settings.
#[tauri::command]
pub(in crate::application) fn inspect_language(
    state: tauri::State<'_, Arc<Application>>,
    language: String,
    variety: Option<String>,
    explanation: String,
    explanation_variety: Option<String>,
) -> Result<crate::configuration::LanguageInspection> {
    Ok(state.lock()?.config.inspect_language(
        &language,
        variety.as_deref(),
        &explanation,
        explanation_variety.as_deref(),
    )?)
}

/// Pure local preview using the same parser and renderer as accepted turns.
#[tauri::command]
pub(in crate::application) fn preview_conversation_prompt(
    state: tauri::State<'_, Arc<Application>>,
    conversation_id: String,
    configuration: Option<crate::conversations::direction::ConversationStartConfig>,
    yaml: Option<String>,
) -> Result<crate::conversations::direction::PromptPreview> {
    let configuration=match (configuration,yaml) {
        (Some(value),None)=>value,
        (None,Some(text)) if text.len()<=16000 => serde_yaml_ng::from_str(&text).map_err(|_|AppError::new(ErrorCode::Validation,"Invalid configuration YAML. Check required fields, values, duplicate keys and indentation."))?,
        _=>return Err(AppError::new(ErrorCode::Validation,"Supply a configuration or at most 16 KB of YAML.")),
    };
    let store = state.lock()?;
    crate::conversations::conversation_prompt::preview(
        &store.config,
        &store.snapshot()?,
        &conversation_id,
        &configuration,
    )
}

/// Application blueprints, available without a selected conversation or AI access.
#[tauri::command]
pub(in crate::application) fn get_ai_graph_definitions()
-> Result<Vec<crate::diagnostics::ai_graphs::AiGraphDefinition>> {
    crate::diagnostics::ai_graphs::definitions()
}
