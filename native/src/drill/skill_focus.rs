//! Capture a generation target without creating learner evidence or credit.
use crate::{
    configuration::LanguageContext,
    learning::{
        practice_assessment::SkillPrompt,
        recommendations::{self, Recommendation, RecommendationMode},
    },
    model::*,
    storage::store::Store,
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum DrillSkillTarget {
    Skill { skill_id: String },
    Coach { mode: RecommendationMode },
}

#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DrillSkillFocus {
    pub skill: SkillPrompt,
    pub recommendation: Option<Recommendation>,
}

pub(crate) fn capture(
    store: &Store,
    context: &LanguageContext,
    target: Option<&DrillSkillTarget>,
    seed: &str,
) -> Result<Option<DrillSkillFocus>> {
    let Some(target) = target else {
        return Ok(None);
    };
    let (id, recommendation) = match target {
        DrillSkillTarget::Skill { skill_id } => (skill_id.clone(), None),
        DrillSkillTarget::Coach { mode } => {
            let ids = store
                .config
                .skill_coverage(&context.language_id, &context.variety_id)?
                .into_iter()
                .filter(|entry| entry.guide_available)
                .map(|entry| entry.skill_id)
                .collect::<Vec<_>>();
            let snapshot = crate::learning::learner::progression::snapshot_db(
                &store.connection,
                &store.config,
                &store.session_id,
                &context.language_id,
            )?;
            let selected = recommendations::choose(
                &recommendations::candidates(&snapshot, &context.variety_id, &ids)?,
                *mode,
                seed,
            )?;
            (selected.skill.skill_id.clone(), Some(selected))
        }
    };
    let skill = store
        .config
        .skill_prompt(&context.language_id, &context.variety_id, &id)?;
    Ok(Some(DrillSkillFocus {
        skill,
        recommendation,
    }))
}
