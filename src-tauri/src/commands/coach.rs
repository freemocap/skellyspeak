//! The coach: per-message feedback on what the learner said, and the
//! private side-thread they can ask questions in.

use serde::{Deserialize, Serialize};
use log::info;
use serde_json::json;
use tauri::{Emitter, State};
use crate::lesson::{self, LessonChoices, LessonState};
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
    pub proposal: Option<LessonChoices>,
    pub lesson: LessonState,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
enum LessonAction { Answer, Apply, Propose }

#[derive(Debug, Deserialize, schemars::JsonSchema)]
struct CoachDecision {
    reply: String,
    action: LessonAction,
    request_quote: Option<String>,
    choices: Option<LessonChoices>,
}

impl CoachDecision {
    fn validate(&self, question: &str) -> Option<String> {
        if self.reply.trim().is_empty() { return Some("Reply must not be empty".into()); }
        match self.action {
            LessonAction::Answer if self.choices.is_some() => return Some("Answer must have null choices".into()),
            LessonAction::Apply | LessonAction::Propose if self.choices.is_none() => return Some("Lesson change requires complete choices".into()),
            _ => {}
        }
        if matches!(self.action, LessonAction::Apply)
            && !self.request_quote.as_ref().is_some_and(|q| !q.trim().is_empty() && question.contains(q)) {
            return Some("Apply requires a verbatim quote of the latest learner request".into());
        }
        self.choices.as_ref().and_then(LessonChoices::validate)
    }
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
    /// 1-5: conversational fit in this exchange, independent of grammar.
    pub conversation: u8,
    /// 1-5: grammatical correctness.
    pub grammar: u8,
}

impl CoachFeedback {
    pub fn validate(&self) -> Option<String> {
        if self.remark.trim().is_empty() {
            return Some("remark must not be empty".into());
        }
        if !(1..=5).contains(&self.conversation) || !(1..=5).contains(&self.grammar) {
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
    /// Added to persisted coach messages; historical messages have no proposal.
    #[serde(default)]
    pub proposal: Option<LessonChoices>,
    #[serde(default)]
    pub lesson_revision: Option<u64>,
}

/// The coach thread belongs to one chat: it discusses that conversation.
use crate::conversation::COACH_FILE as COACH_THREAD_FILE;
const COACH_THREAD_CAP: usize = 40;

/// Historical understanding scores are retained as historical data, never relabeled as conversational fit.
#[derive(Deserialize, Serialize)]
#[serde(untagged)]
enum RecordedFeedback { Current(CoachFeedback), Historical(HistoricalFeedback) }

#[derive(Deserialize, Serialize)]
struct HistoricalFeedback {
    remark: String,
    used_target: Vec<String>,
    used_native: Vec<String>,
    corrections: Vec<CoachCorrection>,
    comprehensibility: u8,
    grammar: u8,
}

#[derive(Deserialize, Serialize)]
struct ContextReply { reply: String }

#[derive(Deserialize, Serialize)]
struct ContextTurn {
    user: Option<String>,
    assistant: Option<ContextReply>,
    coach: Option<RecordedFeedback>,
}

fn conversation_context(turns: serde_json::Value) -> Result<String, String> {
    let turns: Vec<ContextTurn> = serde_json::from_value(turns)
        .map_err(|e| format!("Cannot read coach conversation context: {e}"))?;
    serde_json::to_string(&turns.iter().rev().take(8).rev().collect::<Vec<_>>())
        .map_err(|e| format!("Cannot serialize coach context: {e}"))
}

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
            log::error!("Persistence failed; details reported to the UI");
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
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    question: String,
    chat_id: String,
    expected_revision: u64,
    level: crate::prompts::difficulty::Difficulty,
    topic: String,
) -> Result<CoachReply, String> {
    let _request = state.coach_request.try_lock().map_err(|_| "The coach is already answering a question.")?;
    let (epoch, stored, pair, coach_dir, mut thread, plan, profile, lesson, context, skill_context) = {
        let epoch = state.context_epoch.lock().expect("context lock poisoned");
        let stored = state.settings.lock().expect("settings lock poisoned").clone();
        let (pair, coach_dir, current) = pair_and_chat(&state, &stored.target_language, &stored.native_language)?;
        if current != chat_id { return Err("The conversation changed before the coach request.".into()); }
        let lesson = lesson::load(&pair)?;
        if lesson.revision != expected_revision { return Err("The lesson changed. Review it before asking again.".into()); }
        let loaded = crate::conversation::load_session(&coach_dir);
        if let Some(error) = loaded.fault { return Err(error); }
        let context = conversation_context(loaded.turns)?;
        let thread = state.coach_thread.lock().expect("coach lock poisoned").clone();
        let plan = state.plan.lock().expect("plan lock poisoned").clone();
        let profile = state.profile.lock().expect("profile lock poisoned").clone();
        let evidence = crate::skills::snapshot(&state.config_dir, &stored.target_language)?;
        let skill_profile = crate::skills::progress::project(&evidence, crate::skills::progress::load(&state.config_dir, &stored.target_language)?)?;
        let skill_context = prompts::skills::practice(&evidence, &skill_profile)?.content;
        (*epoch, stored, pair, coach_dir, thread, plan, profile, lesson, context, skill_context)
    };
    let question = question.trim().to_string();
    if question.is_empty() {
        return Err("empty question".into());
    }
    let started = std::time::Instant::now();
    let tln = crate::languages::language_display(&stored.target_language);
    let native = crate::languages::native_display(&stored.native_language);

    let request_context = crate::instruction::Context {
        chat_id: chat_id.clone(), message_id: None, replaces_message_id: None, trigger: "coach_question".into(),
        target: stored.target_language.clone(), native: stored.native_language.clone(), dialect: stored.target_dialect.clone(), provider_mode: stored.provider_mode.clone(),
        difficulty: level, inferred_level_notes: profile.level_notes.clone(), topic: Some(topic.clone()), lesson_revision: lesson.revision,
        partner: serde_json::to_value(crate::conversation_partner::load(&coach_dir)?).map_err(|e| e.to_string())?, history_messages: thread.len().min(COACH_THREAD_CAP), history_available: thread.len(),
    };
    let choices = format!("{}\n{}\nSelected practice topic: {}", lesson.choices.directives(), level.coaching_context(), topic) + "\n" + &skill_context;
    let (plan_json, profile_json) = prompts::observer::documents_json(&plan, &profile);
    let mut messages = vec![json!({
        "role": "system",
        "content": prompts::coach::thread_system(&tln, &native, &plan_json, &profile_json, &choices),
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
    let decision = provider
        .structured_validated::<CoachDecision, _>(
            RunContext::new(ontology::op::ANSWER, None).with_context(&request_context),
            &messages,
            0.5,
            "CoachDecision",
            false,
            Some(crate::ai::MaxTokens(3000)),
            |decision| decision.validate(&question),
        )
        .await
        .map_err(|e| format!("coach ask failed: {e}"))?;
    let reply = sanitize_reply(&decision.reply);
    if reply.trim().is_empty() { return Err("The coach returned an empty answer.".into()); }
    info!(
        "[cmd] coach ask answered in {:.1}s: {} chars",
        started.elapsed().as_secs_f32(),
        reply.len()
    );

    let mut current_lesson = lesson;
    let proposal = if matches!(decision.action, LessonAction::Propose) { decision.choices.clone() } else { None };
    {
        let context = state.context_epoch.lock().expect("context lock poisoned");
        if *context != epoch { return Err("Conversation changed while the coach was answering.".into()); }
        if lesson::load(&pair)?.revision != expected_revision {
            return Err("The lesson changed while the coach was answering. Please ask again.".into());
        }
        if matches!(decision.action, LessonAction::Apply) {
            current_lesson = lesson::save(&pair, expected_revision,
                decision.choices.expect("validated lesson choices"), "coach · your request",
                decision.request_quote.as_deref().expect("validated request quote"))?;
            app.emit("lesson-changed", ()).map_err(|e| format!("Lesson saved but refresh failed: {e}"))?;
        }
        thread.push(CoachChatMessage {
            role: "user".into(),
            content: question.clone(),
            proposal: None,
            lesson_revision: None,
        });
        thread.push(CoachChatMessage {
            role: "coach".into(),
            content: reply.clone(),
            proposal: proposal.clone(),
            lesson_revision: Some(current_lesson.revision),
        });
        let len = thread.len();
        if len > COACH_THREAD_CAP {
            thread.drain(0..len - COACH_THREAD_CAP);
        }
        let dir = coach_dir.clone();
        persist_coach_thread(&dir, &thread).map_err(|e| format!("Coach history could not be saved; lesson is at revision {}: {e}", current_lesson.revision))?;
        *state.coach_thread.lock().expect("coach lock poisoned") = thread;
    }
    Ok(CoachReply { reply, proposal, lesson: current_lesson })
}

#[cfg(test)]
mod lesson_tests {
    use super::*;

    #[test]
    fn context_keeps_recent_messages_without_full_token_analysis() {
        let turns = (0..12).map(|i| json!({"user": format!("Message {i}"), "assistant": {"reply": format!("Reply {i}"), "tokens": ["not coach context"]}})).collect::<Vec<_>>();
        let context = conversation_context(json!(turns)).unwrap();
        let rows: serde_json::Value = serde_json::from_str(&context).unwrap();
        assert_eq!(rows.as_array().unwrap().len(), 8);
        assert_eq!(rows[0]["user"], "Message 4");
        assert_eq!(rows[7]["assistant"]["reply"], "Reply 11");
        assert!(!context.contains("tokens"));
        assert!(conversation_context(json!([{"assistant": {"reply": 42}}])).is_err());
    }

    #[test]
    fn applying_requires_current_request_evidence_and_valid_choices() {
        let mut decision = CoachDecision { reply: "Changed".into(), action: LessonAction::Apply,
            request_quote: Some("Practise travel".into()), choices: Some(LessonChoices::default()) };
        assert!(decision.validate("What is the past tense?").is_some());
        assert!(decision.validate("Practise travel please").is_none());
        decision.action = LessonAction::Propose;
        assert!(decision.validate("What should I practise?").is_none());
        decision.action = LessonAction::Answer;
        assert!(decision.validate("Hi").is_some());
    }

    #[test]
    fn current_feedback_requires_conversational_fit_and_preserves_historical_meaning() {
        let historical = json!({"remark":"A clear message.","used_target":[],"used_native":[],"corrections":[],"grammar":5,"comprehensibility":4});
        assert!(serde_json::from_value::<CoachFeedback>(historical.clone()).is_err());
        assert!(matches!(serde_json::from_value::<RecordedFeedback>(historical.clone()).unwrap(), RecordedFeedback::Historical(_)));
        let mut current = historical;
        current.as_object_mut().unwrap().remove("comprehensibility");
        current["conversation"] = json!(5);
        let feedback: CoachFeedback = serde_json::from_value(current.clone()).unwrap();
        assert!(feedback.validate().is_none());
        assert!(matches!(serde_json::from_value::<RecordedFeedback>(current).unwrap(), RecordedFeedback::Current(_)));
        let invalid = CoachFeedback { conversation: 0, ..feedback };
        assert!(invalid.validate().is_some());
    }
}
