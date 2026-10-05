//! One bounded Jev request for skills, grammar and understandability.
//! Transport and durable credit publication belong to the turn executor.
use crate::learning::practice_assessment::{self, Answer, Instructions, SkillPrompt};
use crate::model::{AppError, ErrorCode, Result};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::{BTreeMap, BTreeSet};

pub const GRAMMAR_LABELS: [&str; 4] = [
    "acceptable",
    "local_errors",
    "major_errors",
    "insufficient_evidence",
];
pub const UNDERSTANDABILITY_LABELS: [&str; 4] = [
    "understandable",
    "needs_clarification",
    "unrecoverable",
    "insufficient_evidence",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Question {
    pub instructions: String,
    pub criteria: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MessageQuestions {
    pub grammar: Question,
    pub understandability: Question,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Assessment {
    pub skills: BTreeMap<String, Answer>,
    pub grammar: crate::learning::coaching::message_assessment::ChoiceAssessment,
    pub understandability: crate::learning::coaching::message_assessment::ChoiceAssessment,
}

fn invalid(path: &str) -> AppError {
    AppError::new(ErrorCode::Validation, "Invalid turn assessment.").with_diagnostics(json!({
        "validation": {"stage":"turn_assessment", "path":path,
        "expected":"complete named questions and choices; finite probabilities and confidence in [0,1]"}
    }))
}

pub fn request(
    state: Value,
    skills: &[SkillPrompt],
    shared: &Instructions,
    message: &MessageQuestions,
) -> Result<Value> {
    if skills.len() != 8 {
        return Err(invalid("skills"));
    }
    let mut body = practice_assessment::request(state, skills, shared)?;
    for (name, question, labels) in [
        ("grammar", &message.grammar, GRAMMAR_LABELS),
        (
            "understandability",
            &message.understandability,
            UNDERSTANDABILITY_LABELS,
        ),
    ] {
        if body["questions"].get(name).is_some()
            || question.instructions.trim().is_empty()
            || question.criteria.len() != labels.len()
            || labels.iter().any(|label| {
                question
                    .criteria
                    .get(*label)
                    .is_none_or(|s| s.trim().is_empty())
            })
        {
            return Err(invalid(name));
        }
        let value = json!({"type":"choice", "instructions":question.instructions, "criteria":question.criteria});
        if body["state"].to_string().len() + value.to_string().len() + 4096 > 28000 {
            return Err(invalid(&format!("questions.{name}.budget")));
        }
        body["questions"][name] = value;
    }
    if body.to_string().len() > 100000 {
        return Err(invalid("request_budget"));
    }
    Ok(body)
}

/// Reject incomplete results before callers can publish any credit. Jev's selected
/// choice is authoritative; neither ranking nor the sum of scores replaces it.
pub fn validate(raw: &Value, skills: &BTreeSet<String>) -> Result<Assessment> {
    let object = raw.as_object().ok_or_else(|| invalid("answers"))?;
    if skills.len() != 8
        || object.len() != 10
        || skills.contains("grammar")
        || skills.contains("understandability")
    {
        return Err(invalid("coverage"));
    }
    let skill_answers: serde_json::Map<String, Value> = object
        .iter()
        .filter(|(key, _)| skills.contains(*key))
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect();
    Ok(Assessment {
        skills: practice_assessment::validate(&Value::Object(skill_answers), skills)?,
        grammar: choice(&raw["grammar"], "grammar", &GRAMMAR_LABELS)?,
        understandability: choice(
            &raw["understandability"],
            "understandability",
            &UNDERSTANDABILITY_LABELS,
        )?,
    })
}

fn choice(
    raw: &Value,
    name: &str,
    labels: &[&str],
) -> Result<crate::learning::coaching::message_assessment::ChoiceAssessment> {
    let fail = || invalid(&format!("answers.{name}"));
    if raw["type"] != "choice" {
        return Err(fail());
    }
    let selected = raw["choice"]
        .as_str()
        .filter(|s| labels.contains(s))
        .ok_or_else(fail)?;
    let confidence = raw["confidence"]
        .as_f64()
        .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
        .ok_or_else(fail)?;
    let values = raw["probabilities"]
        .as_object()
        .filter(|v| v.len() == labels.len())
        .ok_or_else(fail)?;
    let mut probabilities = BTreeMap::new();
    for label in labels {
        let value = values
            .get(*label)
            .and_then(Value::as_f64)
            .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
            .ok_or_else(fail)?;
        probabilities.insert((*label).into(), value);
    }
    Ok(
        crate::learning::coaching::message_assessment::ChoiceAssessment {
            choice: selected.into(),
            probabilities,
            confidence,
        },
    )
}

#[cfg(test)]
#[path = "turn_assessment_tests.rs"]
mod tests;
