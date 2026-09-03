//! Conversations on disk: listing, opening, saving and removing chats,
//! and the observer documents that sit above them.

use serde::{Serialize};
use log::{info};
use tauri::{State};
use crate::conversation;
use crate::observer;
use crate::AppState;
use super::coach::init_coach_thread;

// ─── Observer documents ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ObserverDocuments {
    pub plan: observer::TeachingPlan,
    pub profile: observer::Profile,
}

#[tauri::command]
pub fn get_plan(state: State<'_, AppState>) -> Result<ObserverDocuments, String> {
    Ok(ObserverDocuments {
        plan: state.plan.lock().unwrap_or_else(|p| p.into_inner()).clone(),
        profile: state
            .profile
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone(),
    })
}

// ─── Conversation persistence ────────────────────────────────────────────────

/// The pairing directory, the open chat's directory, and its id.
///
/// The pairing is named by the caller rather than read from settings. The
/// webview knows which conversation the turns on screen belong to, and saying
/// so explicitly is what stops a language switch racing an in-flight save and
/// filing one conversation under another's name.
pub(super) fn pair_and_chat(
    state: &AppState,
    target: &str,
    native: &str,
) -> Result<(std::path::PathBuf, std::path::PathBuf, String), String> {
    let pair = conversation::pair_dir(&state.config_dir, target, native)?;
    let id = conversation::ensure_current_chat(&pair)?;
    let chat = conversation::chat_dir(&pair, &id)?;
    Ok((pair, chat, id))
}

/// What the webview needs to show a conversation: which one it is, and its
/// turns. Turns are stored exactly as the webview holds them — the core never
/// interprets one, so there is no second definition of a turn to keep in step.
#[derive(Debug, Serialize)]
pub struct OpenedConversation {
    pub id: String,
    pub turns: serde_json::Value,
}

/// Every chat for this pairing, most recently used first.
#[tauri::command]
pub fn list_conversations(
    state: State<'_, AppState>,
    target: String,
    native: String,
) -> Result<Vec<conversation::ChatSummary>, String> {
    let pair = conversation::pair_dir(&state.config_dir, &target, &native)?;
    Ok(conversation::list_chats(&pair))
}

/// The chat currently open for this pairing, starting one if there is none.
#[tauri::command]
pub fn load_conversation(
    state: State<'_, AppState>,
    target: String,
    native: String,
) -> Result<OpenedConversation, String> {
    let (_pair, chat, id) = pair_and_chat(&state, &target, &native)?;
    let loaded = conversation::load_session(&chat);
    // A conversation that could not be read is reported, not silently empty.
    if let Some(fault) = loaded.fault {
        return Err(fault);
    }
    info!(
        "[cmd] load_conversation {} chat={id}: {} turns",
        conversation::pair_key(&target, &native),
        loaded.turns.as_array().map(Vec::len).unwrap_or(0)
    );
    Ok(OpenedConversation {
        id,
        turns: loaded.turns,
    })
}

/// Switch to another chat in this pairing. Its coach thread comes with it —
/// the coach discusses one conversation, so carrying the previous one across
/// would have it commenting on things that are no longer on screen.
#[tauri::command]
pub fn open_conversation(
    state: State<'_, AppState>,
    target: String,
    native: String,
    id: String,
) -> Result<OpenedConversation, String> {
    let pair = conversation::pair_dir(&state.config_dir, &target, &native)?;
    let chat = conversation::chat_dir(&pair, &id)?;
    conversation::set_current_chat(&pair, &id)?;
    info!("[cmd] open_conversation {id}");

    let mut faults: Vec<String> = Vec::new();
    let thread = init_coach_thread(&chat, &mut faults);
    *state.coach_thread.lock().unwrap_or_else(|p| p.into_inner()) = thread;

    let loaded = conversation::load_session(&chat);
    if let Some(fault) = loaded.fault {
        return Err(fault);
    }
    if let Some(first) = faults.into_iter().next() {
        return Err(first);
    }
    Ok(OpenedConversation {
        id,
        turns: loaded.turns,
    })
}

/// Write the turn log for the chat the caller names.
///
/// The title is supplied by the webview because it is derived from the first
/// thing said, and the webview is the side that knows what a turn looks like.
#[tauri::command]
pub fn save_conversation(
    state: State<'_, AppState>,
    target: String,
    native: String,
    id: String,
    turns: serde_json::Value,
    title: String,
) -> Result<(), String> {
    if !turns.is_array() {
        return Err("A conversation must be a list of turns.".into());
    }
    let pair = conversation::pair_dir(&state.config_dir, &target, &native)?;
    let chat = conversation::chat_dir(&pair, &id)?;
    conversation::save_session(&chat, &turns, &title)
}

/// Start a fresh chat for this pairing and make it the open one.
///
/// The observer's plan and profile are deliberately untouched: they live above
/// the chats, per pairing, and are what the tutor has learned about this
/// learner in this language. Starting a new conversation should not make it
/// forget you.
#[tauri::command]
pub fn new_conversation(
    state: State<'_, AppState>,
    target: String,
    native: String,
) -> Result<String, String> {
    let pair = conversation::pair_dir(&state.config_dir, &target, &native)?;
    let id = conversation::unique_chat_id(&pair)?;
    conversation::chat_dir(&pair, &id)?;
    conversation::set_current_chat(&pair, &id)?;
    // A new conversation starts with a coach that has not heard anything yet.
    state
        .coach_thread
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clear();
    info!("[cmd] new_conversation {id}");
    Ok(id)
}

/// Take a chat out of the list. Its files stay, marked with the time it was
/// removed, so an accidental delete is recoverable by opening the file.
#[tauri::command]
pub fn delete_conversation(
    state: State<'_, AppState>,
    target: String,
    native: String,
    id: String,
) -> Result<(), String> {
    let pair = conversation::pair_dir(&state.config_dir, &target, &native)?;
    info!("[cmd] delete_conversation {id}");
    conversation::delete_chat(&pair, &id)
}
