//! Learner-requested advice regeneration with the previous advice as context.

use serde::{Deserialize};
use serde_json::json;
use tauri::{State};
use crate::ontology;
use crate::languages::{language_display, native_display, overlay};
use crate::prompts;
use crate::trace::{RunContext};
use crate::AppState;
use super::guided::{ChatTurn, CoachHelp, Scaffolds, ScaffoldsOut};

// ─── Advice refresh ────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ScaffoldRequest {
    chat_id: String,
    history: Vec<ChatTurn>,
    level: crate::prompts::difficulty::Difficulty,
    topic: Option<String>,
    dialect: Option<String>,
    previous_advice: CoachHelp,
}

/// Regenerate advice for the current exchange, explicitly avoiding prior replies.
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
    let messages = refresh_messages(&prompts::analysis::scaffolds_prompt(&tln, cefr, &native, &directives), &transcript.join("\n"), &req.previous_advice)?;
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
            |sc: &ScaffoldsOut| sc.validate().or_else(|| {
                if sc.coach_help.partner.text != req.previous_advice.partner.text {
                    return Some("Refresh advice for the same exact partner message.".into());
                }
                sc.replies.iter().any(|reply| req.previous_advice.replies.iter().any(|previous| previous.text.trim().to_lowercase() == reply.trim().to_lowercase()))
                    .then(|| "The learner requested different advice. Do not repeat a previous suggested reply.".into())
            }),
        )
        .await?;
    if *state.context_epoch.lock().expect("context lock poisoned") != epoch { return Err("The conversation changed while refreshing suggestions.".into()); }
    Ok(out.scaffolds())
}

fn refresh_messages(system: &str, transcript: &str, previous: &CoachHelp) -> Result<Vec<serde_json::Value>, String> {
    Ok(vec![
        json!({"role": "system", "content": system}),
        json!({"role": "user", "content": prompts::analysis::scaffolds_from_transcript_turn(transcript)}),
        json!({"role": "assistant", "content": serde_json::to_string(previous).map_err(|e| e.to_string())?}),
        json!({"role": "user", "content": prompts::analysis::scaffolds_refresh_request()}),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn refresh_attaches_previous_advice_before_requesting_different_replies() {
        let previous: CoachHelp = serde_json::from_value(json!({
            "explanation": "They greeted you.",
            "partner": { "text": "Hola", "translation": "Hello", "romanization": null, "pronunciation": "OH-lah" },
            "replies": [{ "text": "Hola", "translation": "Hello", "romanization": null, "pronunciation": "OH-lah" }]
        })).unwrap();
        let messages = refresh_messages("system", "NATIVE: Hola", &previous).unwrap();
        assert_eq!(messages[2]["role"], "assistant");
        let attached: serde_json::Value = serde_json::from_str(messages[2]["content"].as_str().unwrap()).unwrap();
        assert_eq!(attached, serde_json::to_value(previous).unwrap());
        assert_eq!(messages[3]["role"], "user");
        assert!(messages[3]["content"].as_str().unwrap().contains("requested different advice"));
    }
}
