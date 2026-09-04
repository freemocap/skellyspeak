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
    history: Vec<ChatTurn>,
    level: Option<String>,
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
    let stored = state
        .settings
        .lock()
        .unwrap_or_else(|p| p.into_inner())
        .clone();
    let tln = language_display(&stored.target_language);
    let native = native_display(&stored.native_language);
    let _cefr = match req.level.as_deref() {
        Some("intermediate") => "B1",
        Some("advanced") => "C1",
        _ => "A2",
    };
    let topic_directive = prompts::partner::topic_directive(req.topic.as_deref());
    let plan_directives = {
        let plan = state.plan.lock().unwrap_or_else(|p| p.into_inner());
        prompts::observer::directives_block(&plan, &[])
    };
    let dialect_overlay =
        overlay(&stored.target_language, req.dialect.as_deref());
    let directives = format!(
        "{dialect_overlay}{plan_directives}{topic_directive}"
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
        json!({"role": "system", "content": prompts::analysis::scaffolds_prompt(&tln, &native, &directives)}),
        json!({"role": "user", "content": prompts::analysis::scaffolds_from_transcript_turn(&transcript.join("\n"))}),
    ];
    let provider = stored.chat_provider(&stored.openrouter_model)?;
    let out = provider
        .structured_validated::<ScaffoldsOut, _>(
            RunContext::new(ontology::op::SUGGEST, None),
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
    Ok(Scaffolds {
        replies: out.replies,
        frames: out.frames,
        starters: out.starters,
    })
}
