use super::*;

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
        tauri::WebviewWindowBuilder::new(
            &app,
            "ai",
            tauri::WebviewUrl::App("index.html?view=ai".into()),
        )
        .title("SkellySpeak · AI activity")
        .inner_size(1000.0, 700.0)
        .min_inner_size(380.0, 400.0)
        .build()
        .map_err(|_| AppError::new(ErrorCode::Internal, "Could not open the AI window."))?;
    }
    Ok(())
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
