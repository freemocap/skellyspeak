//! The coach: per-message feedback on what the learner said, and the
//! private side-thread they can ask questions in.

use serde::{Deserialize, Serialize};
use log::info;
use serde_json::json;
use tauri::{State};
use crate::ontology;
use crate::prompts;
use crate::trace::{RunContext};
use crate::AppState;
use std::path::Path;
use super::conversations::pair_and_chat;
use super::guided::sanitize_reply;

// ─── Coach (the sidebar tutor) ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct CoachCorrection {
    /// What the learner actually wrote/said (verbatim fragment).
    pub said: String,
    /// What a fluent speaker would say.
    pub corrected: String,
    /// Why, in the learner's NATIVE language.
    pub explanation: String,
    /// grammar | vocab | word-choice | spelling | other
    pub kind: String,
}

#[derive(Debug, Serialize)]
pub struct CoachReply {
    pub reply: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
pub struct CoachFeedback {
    /// 1-3 warm sentences to the learner. Mostly native language; answers
    /// questions the learner embedded in their message.
    #[schemars(length(min = 1))]
    pub remark: String,
    /// Target-language fragments the learner produced (verbatim).
    pub used_target: Vec<String>,
    /// Native-language fragments they fell back on (verbatim).
    pub used_native: Vec<String>,
    /// 0-3 corrections. Empty is valid — a perfect message earns empty.
    pub corrections: Vec<CoachCorrection>,
    /// 1-5: would a native speaker understand the message?
    pub comprehensibility: u8,
    /// 1-5: grammatical correctness.
    pub grammar: u8,
}

impl CoachFeedback {
    pub fn validate(&self) -> Option<String> {
        if self.remark.trim().is_empty() {
            return Some("remark must not be empty".into());
        }
        if !(1..=5).contains(&self.comprehensibility) || !(1..=5).contains(&self.grammar) {
            return Some("scores must be 1-5".into());
        }
        for c in &self.corrections {
            if c.said.trim().is_empty() || c.corrected.trim().is_empty() {
                return Some("corrections must cite actual words".into());
            }
        }
        None
    }
}

// ─── Coach thread (interactive sidebar chat — PRIVATE to the learner) ────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoachChatMessage {
    /// "user" (learner) or "coach".
    pub role: String,
    pub content: String,
}

/// The coach thread belongs to one chat: it discusses that conversation.
use crate::conversation::COACH_FILE as COACH_THREAD_FILE;
const COACH_THREAD_CAP: usize = 40;

pub fn init_coach_thread(dir: &Path, faults: &mut Vec<String>) -> Vec<CoachChatMessage> {
    let path = dir.join(COACH_THREAD_FILE);
    let raw = match crate::persistence::read(&path) {
        Ok(Some(raw)) => raw,
        Ok(None) => return Vec::new(),
        Err(error) => { faults.push(error); return Vec::new(); }
    };
    match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(e) => {
            let fault = format!("{} could not be read: {e}. Repair the file before continuing.", path.display());
            log::error!("{fault}");
            faults.push(fault);
            Vec::new()
        }
    }
}

pub(super) fn persist_coach_thread(dir: &Path, thread: &[CoachChatMessage]) -> Result<(), String> {
    let raw = serde_json::to_vec_pretty(thread).map_err(|e| format!("coach serialization failed: {e}"))?;
    crate::persistence::write(&dir.join(COACH_THREAD_FILE), &raw)
}
#[tauri::command]
pub fn get_coach_thread(state: State<'_, AppState>) -> Result<Vec<CoachChatMessage>, String> {
    Ok(state
        .coach_thread
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone())
}

#[tauri::command]
pub fn coach_thread_clear(state: State<'_, AppState>) -> Result<(), String> {
    let mut epoch = state.context_epoch.lock().expect("context lock poisoned");
    let (target, native) = {
        let st = state.settings.lock().unwrap_or_else(|p| p.into_inner());
        (st.target_language.clone(), st.native_language.clone())
    };
    let (_pair, dir, _id) = pair_and_chat(&state, &target, &native)?;
    persist_coach_thread(&dir, &[])?;
    state.coach_thread.lock().expect("coach lock poisoned").clear();
    *epoch += 1;
    Ok(())
}

/// Ask the coach a direct question. Sees the primary conversation, the plan,
/// the profile, and this thread. PRIVATE: the native-speaker agent never
/// sees any of it (Cyrano principle).
#[tauri::command]
pub async fn coach_ask(
    state: State<'_, AppState>,
    question: String,
    context: String,
) -> Result<CoachReply, String> {
    let _request = state.coach_request.try_lock().map_err(|_| "The coach is already answering a question.")?;
    let (epoch, stored, coach_dir, mut thread, plan, profile) = {
        let epoch = state.context_epoch.lock().expect("context lock poisoned");
        let stored = state.settings.lock().expect("settings lock poisoned").clone();
        let (_, coach_dir, _) = pair_and_chat(&state, &stored.target_language, &stored.native_language)?;
        let thread = state.coach_thread.lock().expect("coach lock poisoned").clone();
        let plan = state.plan.lock().expect("plan lock poisoned").clone();
        let profile = state.profile.lock().expect("profile lock poisoned").clone();
        (*epoch, stored, coach_dir, thread, plan, profile)
    };
    let question = question.trim().to_string();
    if question.is_empty() {
        return Err("empty question".into());
    }
    let started = std::time::Instant::now();
    let tln = crate::languages::language_display(&stored.target_language);
    let native = crate::languages::native_display(&stored.native_language);

    let (plan_json, profile_json) = prompts::observer::documents_json(&plan, &profile);
    let mut messages = vec![json!({
        "role": "system",
        "content": prompts::coach::thread_system(&tln, &native, &plan_json, &profile_json),
    })];
    for m in thread.iter().rev().take(COACH_THREAD_CAP).rev() {
        let role = if m.role == "user" { "user" } else { "assistant" };
        messages.push(json!({"role": role, "content": m.content}));
    }
    messages.push(json!({
        "role": "user",
        "content": prompts::coach::thread_turn(&context, &question)
    }));

    let provider = stored.chat_provider(&stored.openrouter_model)?;
    let reply = provider
        .chat_streaming(
            RunContext::new(ontology::op::ANSWER, None),
            &messages,
            0.5,
            &mut |_| {},
        )
        .await
        .map_err(|e| format!("coach ask failed: {e}"))?;
    let reply = sanitize_reply(&reply);
    if reply.trim().is_empty() { return Err("The coach returned an empty answer.".into()); }
    info!(
        "[cmd] coach ask answered in {:.1}s: {} chars",
        started.elapsed().as_secs_f32(),
        reply.len()
    );

    {
        let context = state.context_epoch.lock().expect("context lock poisoned");
        if *context != epoch { return Err("Conversation changed while the coach was answering.".into()); }
        thread.push(CoachChatMessage {
            role: "user".into(),
            content: question.clone(),
        });
        thread.push(CoachChatMessage {
            role: "coach".into(),
            content: reply.clone(),
        });
        let len = thread.len();
        if len > COACH_THREAD_CAP {
            thread.drain(0..len - COACH_THREAD_CAP);
        }
        let dir = coach_dir.clone();
        persist_coach_thread(&dir, &thread)?;
        *state.coach_thread.lock().expect("coach lock poisoned") = thread;
    }
    Ok(CoachReply { reply })
}

