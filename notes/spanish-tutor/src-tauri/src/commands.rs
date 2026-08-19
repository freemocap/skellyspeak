//! Tauri command surface exposed to the frontend.

use crate::analysis::Analyzer;
use crate::cards::CardLibrary;
use crate::learner::LearnerModel;
use crate::llm::{ChatMessage, LlmClient};
use crate::orchestrator::{run_turn, TurnResult};
use std::sync::Arc;
use tokio::sync::Mutex;

pub struct AppState {
    pub client: Arc<dyn LlmClient>,
    pub analyzer: Arc<dyn Analyzer>,
    pub library: CardLibrary,
    pub learner: Mutex<LearnerModel>,
    /// Full running transcript for this session (kept server-side).
    pub history: Mutex<Vec<ChatMessage>>,
}

#[tauri::command]
pub async fn send_message(
    state: tauri::State<'_, AppState>,
    text: String,
) -> Result<TurnResult, String> {
    let history = state.history.lock().await.clone();
    let mut learner = state.learner.lock().await;

    let result = run_turn(
        state.client.as_ref(),
        state.analyzer.as_ref(),
        &state.library,
        &mut learner,
        &history,
        &text,
    )
    .await
    .map_err(|e| e.to_string())?;

    // Append this exchange to the running transcript.
    let mut h = state.history.lock().await;
    h.push(ChatMessage::user(text));
    h.push(ChatMessage::assistant(result.reply.clone()));

    Ok(result)
}

#[tauri::command]
pub async fn get_learner(state: tauri::State<'_, AppState>) -> Result<LearnerModel, String> {
    Ok(state.learner.lock().await.clone())
}

#[tauri::command]
pub async fn reset_session(state: tauri::State<'_, AppState>) -> Result<(), String> {
    state.history.lock().await.clear();
    Ok(())
}
