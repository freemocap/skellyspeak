//! Standalone scaffold regeneration, driven by the steer row.

use serde::{Deserialize};
use serde_json::json;
use tauri::{State};
use crate::ontology;
use crate::languages::{language_display, native_display, overlay};
use crate::prompts;
use crate::trace::{RunContext};
use crate::AppState;
use super::guided::{ChatTurn, Scaffolds, ScaffoldsOut};

// ─── Standalone scaffold generation (steer-row driven) ───────────────────────

#[derive(Debug, Deserialize)]
pub struct ScaffoldRequest {
    chat_id: String,
    history: Vec<ChatTurn>,
    level: crate::prompts::difficulty::Difficulty,
    topic: Option<String>,
    dialect: Option<String>,
}

/// Regenerate next-message scaffolds on demand — the steer row calls this
/// when the learner changes level or topic, so suggestions never go stale.
#[tauri::command]
pub async fn generate_scaffolds(
    state: State<'_, AppState>,
    req: ScaffoldRequest,
) -> Result<Scaffolds, String> {
    let (epoch, stored, lesson, plan_directives, partner, inferred_level_notes) = {
        let epoch = state.context_epoch.lock().expect("context lock poisoned");
        let stored = state.settings.lock().expect("settings lock poisoned").clone();
        let pair = crate::conversation::pair_dir(&state.config_dir, &stored.target_language, &stored.native_language)?;
        if crate::conversation::current_chat(&pair)?.as_deref() != Some(req.chat_id.as_str()) { return Err("The conversation changed before refreshing suggestions.".into()); }
        let chat = crate::conversation::chat_dir(&pair, &req.chat_id)?;
        let lesson = crate::lesson::load(&pair)?;
        let plan = state.plan.lock().expect("plan lock poisoned");
        let plan_directives = prompts::observer::directives_block(&plan, &[]);
        let partner = serde_json::to_value(crate::conversation_partner::load(&chat)?).map_err(|e| e.to_string())?;
        let inferred_level_notes = state.profile.lock().expect("profile lock poisoned").level_notes.clone();
        (*epoch, stored, lesson, plan_directives, partner, inferred_level_notes)
    };
    let tln = language_display(&stored.target_language);
    let native = native_display(&stored.native_language);
    let cefr = req.level.cefr();
    let topic_directive = prompts::partner::topic_directive(req.topic.as_deref());
    let dialect_overlay =
        overlay(&stored.target_language, req.dialect.as_deref());
    let choices = lesson.choices.directives();
    let directives = format!(
        "{dialect_overlay}{plan_directives}{topic_directive}{choices}"
    );
    let transcript: Vec<String> = req
        .history
        .iter()
        .rev()
        .take(8)
        .rev()
        .map(|t| {
            format!(
                "{}: {}",
                if t.role == "user" { "LEARNER" } else { "NATIVE" },
                t.content
            )
        })
        .collect();
    let messages = vec![
        json!({"role": "system", "content": prompts::analysis::scaffolds_prompt(&tln, cefr, &native, &directives)}),
        json!({"role": "user", "content": prompts::analysis::scaffolds_from_transcript_turn(&transcript.join("\n"))}),
    ];
    let context = crate::instruction::Context {
        chat_id: req.chat_id, message_id: None, replaces_message_id: None, trigger: "suggestion_refresh".into(),
        target: stored.target_language.clone(), native: stored.native_language.clone(), dialect: stored.target_dialect.clone(), provider_mode: stored.provider_mode.clone(),
        difficulty: req.level, inferred_level_notes,
        topic: req.topic.clone(), lesson_revision: lesson.revision,
        partner, history_messages: transcript.len(), history_available: req.history.len(),
    };
    let provider = stored.chat_provider(&stored.openrouter_model)?;
    let out = provider
        .structured_validated::<ScaffoldsOut, _>(
            RunContext::new(ontology::op::SUGGEST, None).with_context(&context).with_blocks(prompts::analysis::scaffolds_blocks(&tln, cefr, &native, &directives)),
            &messages,
            0.6,
            "ScaffoldsOut",
            false,
            None,
            |sc: &ScaffoldsOut| {
                if sc.replies.is_empty() || sc.frames.is_empty() || sc.starters.is_empty() {
                    Some("all three scaffold lists must be populated".into())
                } else {
                    None
                }
            },
        )
        .await?;
    if *state.context_epoch.lock().expect("context lock poisoned") != epoch { return Err("The conversation changed while refreshing suggestions.".into()); }
    Ok(Scaffolds {
        replies: out.replies,
        frames: out.frames,
        starters: out.starters,
    })
}
