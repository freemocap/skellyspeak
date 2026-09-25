//! Compact presence-only question composition and validation for the new catalog.
//! Caller captures authored content and owns transport, diagnostics and publication.
use crate::learning::practice::Presence;
use crate::model::{AppError, ErrorCode, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Serialize, Deserialize, ts_rs::TS)]
#[serde(deny_unknown_fields)]
pub struct SkillPrompt {
    pub id: String,
    pub name: String,
    pub overview: String,
    pub boundary: String,
    pub language_guidance: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Instructions {
    pub attribution: crate::learning::coaching::skill_attribution::Config,
    pub instructions: String,
    pub question: String,
    pub criteria: BTreeMap<String, String>,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct Answer {
    pub choice: Presence,
    pub probabilities: BTreeMap<String, f64>,
    pub confidence: f64,
}
fn invalid(path: &str) -> AppError {
    AppError::new(ErrorCode::Validation, "Invalid skill-presence assessment.")
        .with_diagnostics(json!({"validation":{"stage":"skill_presence","path":path,"expected":"complete catalog coverage; four finite probabilities in [0,1]; known choice"}}))
}
const LABELS: [&str; 4] = ["absent", "contextual", "direct", "unclear"];
pub fn request(state: Value, skills: &[SkillPrompt], shared: &Instructions) -> Result<Value> {
    if skills.is_empty()
        || skills.len() > 64
        || shared.instructions.trim().is_empty()
        || shared.question.trim().is_empty()
        || shared.criteria.len() != 4
        || LABELS
            .iter()
            .any(|k| shared.criteria.get(*k).is_none_or(|v| v.trim().is_empty()))
    {
        return Err(invalid("content"));
    }
    shared.attribution.validate()?;
    let mut questions = BTreeMap::new();
    for skill in skills {
        if skill.id.len() > 64
            || [
                &skill.id,
                &skill.name,
                &skill.overview,
                &skill.boundary,
                &skill.language_guidance,
            ]
            .iter()
            .any(|s| s.trim().is_empty())
        {
            return Err(invalid("skill_content"));
        }
        let question = json!({"type":"choice","instructions":format!("{}\n\n## {}\n{}\nBoundary: {}\n\n{}\n\n{}",shared.instructions,skill.name,skill.overview,skill.boundary,skill.language_guidance,shared.question),"criteria":shared.criteria});
        if state.to_string().len() + question.to_string().len() + 4096 > 28000 {
            return Err(invalid("question_budget"));
        }
        if questions.insert(skill.id.clone(), question).is_some() {
            return Err(invalid("duplicate_skill"));
        }
    }
    let body = json!({"model":crate::learning::coaching::assessment_adapter::MODEL,"state":state,"questions":questions});
    if body.to_string().len() > 100000 {
        return Err(invalid("request_budget"));
    }
    Ok(body)
}
/// Preserve distributions for inspection, but never turn them into fractional XP.
pub fn validate(raw: &Value, expected: &BTreeSet<String>) -> Result<BTreeMap<String, Answer>> {
    let raw = raw.as_object().ok_or_else(|| invalid("answers"))?;
    if expected.is_empty() || raw.len() != expected.len() {
        return Err(invalid("coverage"));
    }
    let mut answers = BTreeMap::new();
    for id in expected {
        let a = raw.get(id).ok_or_else(|| invalid("coverage"))?;
        let failure = || invalid(&format!("answers.{id}"));
        if a["type"] != "choice" {
            return Err(failure());
        }
        let choice = a["choice"]
            .as_str()
            .filter(|s| LABELS.contains(s))
            .ok_or_else(failure)?;
        let confidence = a["confidence"]
            .as_f64()
            .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
            .ok_or_else(failure)?;
        let p = a["probabilities"]
            .as_object()
            .filter(|p| p.len() == 4)
            .ok_or_else(failure)?;
        let mut probabilities = BTreeMap::new();
        for label in LABELS {
            let value = p
                .get(label)
                .and_then(Value::as_f64)
                .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
                .ok_or_else(failure)?;
            probabilities.insert(label.to_owned(), value);
        }
        // The returned choice is authoritative; probabilities are retained, not reconciled.
        answers.insert(
            id.clone(),
            Answer {
                choice: serde_json::from_value(json!(choice))?,
                probabilities,
                confidence,
            },
        );
    }
    Ok(answers)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn composes_presence_only_without_catalog_size_or_language_branches() {
        let shared: Instructions = serde_yaml_ng::from_str(include_str!(
            "../../../content/prompts/skills/presence.yaml"
        ))
        .unwrap();
        let skills = [SkillPrompt {
            id: "language_extension".into(),
            name: "Example".into(),
            overview: "Meaning".into(),
            boundary: "Scope".into(),
            language_guidance: "Selected variety guidance".into(),
        }];
        let body = request(json!({"currentLearnerMessage":"原文"}), &skills, &shared).unwrap();
        assert_eq!(body["questions"].as_object().unwrap().len(), 1);
        assert_eq!(
            body["questions"]["language_extension"]["criteria"]
                .as_object()
                .unwrap()
                .len(),
            4
        );
        assert!(
            body["questions"]["language_extension"]["criteria"]
                .get("successful")
                .is_none()
        );
    }
    #[test]
    fn retains_choice_and_probabilities_without_reconciling_them() {
        let mut raw = json!({"past":{"type":"choice","choice":"contextual","confidence":0.8,"probabilities":{"absent":0.1,"contextual":0.8,"direct":0.05,"unclear":0.05}}});
        let ids = BTreeSet::from(["past".into()]);
        let valid = validate(&raw, &ids).unwrap();
        assert_eq!(valid["past"].choice, Presence::Contextual);
        assert_eq!(valid["past"].probabilities["direct"], 0.05);
        assert!(validate(&raw, &BTreeSet::from(["other".into()])).is_err());
        raw["past"]["choice"] = json!("direct");
        assert_eq!(
            validate(&raw, &ids).unwrap()["past"].choice,
            Presence::Direct
        );
        raw["past"]["choice"] = json!("contextual");
        raw["past"]["probabilities"]["direct"] = json!(0.9);
        let valid = validate(&raw, &ids).unwrap();
        assert_eq!(valid["past"].choice, Presence::Contextual);
        assert_eq!(valid["past"].probabilities["direct"], 0.9);
        raw["past"]["choice"] = json!("unknown");
        assert!(validate(&raw, &ids).is_err());
        raw["past"]["choice"] = json!("direct");
        raw["past"]["probabilities"]["direct"] = json!(1.1);
        assert!(validate(&raw, &ids).is_err());
    }
}
