//! Required skill assessment uses Jev presence; grammar ratings have a separate owner.
use crate::ai::transport::provider::{Completion, PromptMessage};
use crate::learning::practice_assessment::{self, Instructions, SkillPrompt};
use crate::model::{AppError, AssessmentAdapter, ErrorCode, Result};
use rusqlite::Connection;
use serde_json::{Value, json};
use std::collections::BTreeSet;

pub const MODEL: &str = "typesafe/jev-1.13";
pub const VERSION: &str = "jev-skill-presence-1";
pub fn version(_: AssessmentAdapter) -> &'static str {
    VERSION
}
pub fn selected(captured: &Value) -> Result<AssessmentAdapter> {
    if captured["assessmentAdapter"] != "jev_choice" {
        return Err(fail("Skill presence requires the captured Jev adapter."));
    }
    Ok(AssessmentAdapter::JevChoice)
}
fn fail(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}
pub(super) fn skills(captured: &Value) -> Result<Vec<SkillPrompt>> {
    if !captured["presenceContentError"].is_null() {
        return Err(fail("Skill guidance is unavailable for this language and variety.")
            .with_diagnostics(json!({"validation":{"stage":"skill_content","path":captured["presenceContentError"]["path"],"expected":"guidance for every selected skill and variety"}})));
    }
    serde_json::from_value(captured["presenceSkills"].clone()).map_err(|cause| {
        crate::diagnostics::response::json_context(
            &cause,
            "skill_content",
            fail("Missing captured skill content."),
        )
    })
}
pub fn request(messages: &[PromptMessage], captured: &Value) -> Result<Value> {
    let mut state: Value = serde_json::from_str(
        &messages
            .get(1)
            .ok_or_else(|| fail("Missing assessment input."))?
            .content,
    )?;
    state
        .as_object_mut()
        .ok_or_else(|| fail("Invalid assessment state."))?
        .remove("criteria");
    let shared: Instructions = serde_json::from_value(captured["presenceInstructions"].clone())?;
    practice_assessment::request(state, &skills(captured)?, &shared)
}
pub fn validate(
    db: &Connection,
    turn: &str,
    output: &Completion,
    adapter: AssessmentAdapter,
) -> Result<Value> {
    if adapter != AssessmentAdapter::JevChoice
        || output.finish_reason == "error"
        || output.text.len() > 100000
    {
        return Err(fail("Skill presence requires a bounded Jev completion."));
    }
    let raw: String = db.query_row("SELECT context FROM turns WHERE id=?1", [turn], |r| {
        r.get(0)
    })?;
    let captured: Value = serde_json::from_str(&raw)?;
    let ids: BTreeSet<_> = skills(&captured)?.into_iter().map(|s| s.id).collect();
    let raw: Value = serde_json::from_str(&output.text).map_err(|cause| {
        crate::diagnostics::response::json_context(
            &cause,
            "skill_presence",
            fail("Invalid skill presence JSON."),
        )
    })?;
    let answers = practice_assessment::validate(&raw, &ids)?;
    let config: Instructions = serde_json::from_value(captured["presenceInstructions"].clone())?;
    config.attribution.validate()?;
    let presence = answers
        .iter()
        .map(|(id, answer)| {
            let selected = config.attribution.accepts(answer);
            (
                id,
                if selected
                    || matches!(
                        answer.choice,
                        crate::learning::practice::Presence::Absent
                            | crate::learning::practice::Presence::Unclear
                    )
                {
                    answer.choice
                } else {
                    crate::learning::practice::Presence::Absent
                },
            )
        })
        .collect::<std::collections::BTreeMap<_, _>>();
    Ok(
        json!({"presence":presence,"answers":answers,"model":output.actual_model,"adapter":"jev_choice","promptVersion":VERSION,"policy":{"version":crate::learning::practice::POLICY,"minimumPositiveProbability":config.attribution.minimum_positive_probability}}),
    )
}
