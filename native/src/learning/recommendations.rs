//! Optional practice selection from experience and effort, never proficiency.
use crate::{configuration::Registry, model::*};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RecommendationMode {
    Explore,
    ContinuePracticing,
    CoachChoice,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub skill_id: String,
    #[ts(type = "number")]
    pub experience: u64,
    #[ts(type = "number")]
    pub effort: u64,
}
#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Recommendation {
    pub policy: String,
    pub requested: RecommendationMode,
    pub selected: RecommendationMode,
    pub skill: Candidate,
    pub eligible_skills: usize,
}
fn fail(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}
fn tie(seed: &str, id: &str) -> [u8; 32] {
    Sha256::digest(format!("{seed}\0{id}").as_bytes()).into()
}
/// Same profile and seed give the same choice. Ties vary across conversations.
pub fn choose(
    candidates: &[Candidate],
    mode: RecommendationMode,
    seed: &str,
) -> Result<Recommendation> {
    let has_effort = candidates.iter().any(|s| s.effort > 0);
    let selected = match mode {
        RecommendationMode::CoachChoice if has_effort && tie(seed, "mode")[0] % 2 == 1 => {
            RecommendationMode::ContinuePracticing
        }
        RecommendationMode::CoachChoice => RecommendationMode::Explore,
        mode => mode,
    };
    let mut ranked: Vec<_> = candidates
        .iter()
        .filter(|s| selected != RecommendationMode::ContinuePracticing || s.effort > 0)
        .collect();
    ranked.sort_by_key(|s| {
        (
            if selected == RecommendationMode::Explore {
                s.experience
            } else {
                u64::MAX - s.effort
            },
            s.experience,
            tie(seed, &s.skill_id),
        )
    });
    let skill = ranked.first().ok_or_else(|| {
        fail(if selected == RecommendationMode::ContinuePracticing {
            "No retry effort is recorded for this variety yet. Choose Explore or Coach's choice."
        } else {
            "No skill guidance is available for this variety."
        })
    })?;
    Ok(Recommendation {
        policy: "experience-effort-selection-1".into(),
        requested: mode,
        selected,
        skill: (*skill).clone(),
        eligible_skills: ranked.len(),
    })
}
/// Reuse the ledger's exclusion/catalog validation, then scope counts to the exact variety.
pub fn candidates(snapshot: &Value, variety: &str, ids: &[String]) -> Result<Vec<Candidate>> {
    let records = snapshot["records"]
        .as_array()
        .ok_or_else(|| fail("Missing practice records."))?;
    let credits = snapshot["profile"]["credits"]
        .as_array()
        .ok_or_else(|| fail("Missing practice credits."))?;
    ids.iter()
        .map(|id| {
            let mut item = Candidate {
                skill_id: id.clone(),
                experience: 0,
                effort: 0,
            };
            for credit in credits.iter().filter(|c| c["skill_id"] == *id) {
                let record = records
                    .iter()
                    .find(|r| r["attempt_id"] == credit["attempt_id"])
                    .ok_or_else(|| fail("Recommendation credit has no source."))?;
                if record["variety"] != variety {
                    continue;
                }
                item.experience += credit["experience"]
                    .as_u64()
                    .ok_or_else(|| fail("Missing experience count."))?;
                item.effort += credit["effort"]
                    .as_u64()
                    .ok_or_else(|| fail("Missing effort count."))?;
            }
            Ok(item)
        })
        .collect()
}

/// Read-only capture shared by prompt preview and turn admission. Reuse only a
/// focus from the same direction, variety and skill definitions.
pub(crate) fn capture(
    db: &Connection,
    registry: &Registry,
    session: &str,
    conversation: &Conversation,
    direction: &crate::conversations::direction::ConversationDirection,
) -> Result<Option<Value>> {
    use crate::conversations::direction::TopicChoice;
    let Some(TopicChoice::Coach { mode }) = &direction.topic else {
        return Ok(None);
    };
    let identity = json!({"direction":direction,"variety":conversation.settings.variety_id,"catalog":registry.learning_content_hash()});
    let rows: Vec<String> = db.prepare("SELECT context FROM turns WHERE conversation_id=?1 AND json_type(context,'$.practiceRecommendation')='object' ORDER BY rowid DESC LIMIT 1")?.query_map([&conversation.id], |r|r.get(0))?.collect::<rusqlite::Result<_>>()?;
    for raw in rows {
        let context: Value = serde_json::from_str(&raw)?;
        let saved = &context["practiceRecommendation"];
        if saved["identity"] == identity {
            return Ok(Some(saved.clone()));
        }
    }
    let coverage =
        registry.skill_coverage(&conversation.language_id, &conversation.settings.variety_id)?;
    if coverage.iter().any(|s| !s.guide_available) {
        return Err(fail(
            "Coach-led practice requires complete skill guidance for the selected variety.",
        ));
    }
    let ids: Vec<_> = coverage
        .into_iter()
        .filter(|s| s.guide_available)
        .map(|s| s.skill_id)
        .collect();
    let snapshot =
        super::learner::progression::snapshot_db(db, registry, session, &conversation.language_id)?;
    let selected = choose(
        &candidates(&snapshot, &conversation.settings.variety_id, &ids)?,
        *mode,
        &format!("{}:{}", conversation.id, identity),
    )?;
    let skill = registry.skill_prompt(
        &conversation.language_id,
        &conversation.settings.variety_id,
        &selected.skill.skill_id,
    )?;
    Ok(Some(
        json!({"identity":identity,"selection":selected,"skill":skill,"source":"coach","basis":"recorded experience and retry effort; not proficiency"}),
    ))
}
pub(crate) fn append_prompt(
    system: &mut String,
    registry: &Registry,
    recommendation: Option<&Value>,
) -> Result<()> {
    if let Some(value) = recommendation {
        system.push_str(&format!(
            "\n\n{}\nPractice selection (data): {}",
            registry.conversation_prompt().coach_focus,
            serde_json::to_string(value)?
        ));
    }
    Ok(())
}
#[cfg(test)]
#[path = "recommendations_tests.rs"]
mod tests;
