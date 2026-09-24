//! Bounded utterance ratings and observed partner understanding, independent of credit.
use crate::ai::transport::provider::{Completion, PromptMessage};
use crate::model::*;
use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::BTreeMap;
use ts_rs::TS;

pub fn owns(kind: &str) -> bool {
    matches!(kind, "conversation_feedback" | "coach_reaction")
}
pub fn model() -> &'static str {
    super::assessment_adapter::MODEL
}
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
pub struct ChoiceAssessment {
    pub choice: String,
    pub probabilities: BTreeMap<String, f64>,
    pub confidence: f64,
}
pub fn questions(kind: &str) -> Result<Value> {
    let config: Value = serde_yaml_ng::from_str(include_str!(
        "../../../../content/prompts/conversation/ratings.yaml"
    ))
    .map_err(|_| invalid("configuration"))?;
    let key = match kind {
        "conversation_feedback" => "ratings",
        "coach_reaction" => "understanding",
        _ => return Err(invalid("kind")),
    };
    Ok(config[key].clone())
}
fn invalid(path: &str) -> AppError {
    AppError::new(ErrorCode::Validation, "Invalid message assessment.").with_diagnostics(json!({"stage":"message_assessment","path":path,"expected":"complete choices, finite probabilities in [0,1], sum within 0.025 of 1, selected maximum"}))
}
pub fn prompt(
    db: &Connection,
    turn: &str,
    kind: &str,
    captured: &Value,
) -> Result<Vec<PromptMessage>> {
    let learner: String = db.query_row(
        "SELECT text FROM messages WHERE turn_id=?1 AND role='user'",
        [turn],
        |r| r.get(0),
    )?;
    let reply = if kind == "coach_reaction" {
        Some(
            db.query_row(
                "SELECT text FROM messages WHERE turn_id=?1 AND role='assistant'",
                [turn],
                |r| r.get::<_, String>(0),
            )
            .optional()?
            .ok_or_else(|| invalid("partner_reply"))?,
        )
    } else {
        None
    };
    let preceding = captured["messages"]
        .as_array()
        .ok_or_else(|| invalid("messages"))?
        .iter()
        .rev()
        .skip(1)
        .find(|m| m["role"] == "assistant")
        .map(|m| m["content"].clone())
        .unwrap_or(json!(""));
    let mut state = json!({"language":captured["languageContext"]["target_name"],"variety":captured["languageContext"]["variety_name"],"learnerMessage":learner,"precedingPartner":preceding});
    if let Some(reply) = reply {
        state["actualPartnerReply"] = json!(reply);
    }
    Ok(vec![PromptMessage {
        role: "user".into(),
        content: state.to_string(),
    }])
}
pub fn request(messages: &[PromptMessage], kind: &str) -> Result<Value> {
    let state: Value =
        serde_json::from_str(&messages.first().ok_or_else(|| invalid("state"))?.content)?;
    let questions = questions(kind)?;
    for q in questions
        .as_object()
        .ok_or_else(|| invalid("questions"))?
        .values()
    {
        if state.to_string().len() + q.to_string().len() + 4096 > 28000 {
            return Err(invalid("input_limit"));
        }
    }
    Ok(json!({"model":model(),"state":state,"questions":questions}))
}
pub fn validate(kind: &str, output: &Completion) -> Result<Value> {
    if output.finish_reason == "error" || output.text.len() > 32000 {
        return Err(invalid("completion"));
    }
    let raw: Value = serde_json::from_str(&output.text).map_err(|e| {
        crate::diagnostics::response::json_context(
            &e,
            "message_assessment_decode",
            invalid("answers"),
        )
    })?;
    let definitions = questions(kind)?;
    let raw = raw.as_object().ok_or_else(|| invalid("answers"))?;
    let definitions = definitions
        .as_object()
        .ok_or_else(|| invalid("questions"))?;
    if raw.len() != definitions.len() {
        return Err(invalid("coverage"));
    }
    let mut answers = BTreeMap::new();
    for (key, definition) in definitions {
        let a = raw.get(key).ok_or_else(|| invalid(key))?;
        if a["type"] != "choice" {
            return Err(invalid(key));
        }
        let p = a["probabilities"].as_object().ok_or_else(|| invalid(key))?;
        let criteria = definition["criteria"]
            .as_object()
            .ok_or_else(|| invalid(key))?;
        let choice = a["choice"].as_str().ok_or_else(|| invalid(key))?;
        let confidence = a["confidence"]
            .as_f64()
            .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
            .ok_or_else(|| invalid(key))?;
        if p.len() != criteria.len() || !criteria.contains_key(choice) {
            return Err(invalid(key));
        }
        let mut sum = 0.0;
        let mut max: f64 = 0.0;
        let mut probabilities = BTreeMap::new();
        for label in criteria.keys() {
            let v = p
                .get(label)
                .and_then(Value::as_f64)
                .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
                .ok_or_else(|| invalid(key))?;
            sum += v;
            max = max.max(v);
            probabilities.insert(label.clone(), v);
        }
        if (sum - 1.0).abs() > 0.025 || probabilities[choice] + 0.001 < max {
            return Err(invalid(key));
        }
        answers.insert(
            key.clone(),
            ChoiceAssessment {
                choice: choice.into(),
                probabilities,
                confidence,
            },
        );
    }
    if kind == "coach_reaction" {
        Ok(json!({"kind":answers["understanding"].choice,"answer":answers["understanding"]}))
    } else {
        let score = |key: &str| -> Result<Option<u8>> {
            let c = &answers[key].choice;
            if c == "insufficient_evidence" {
                Ok(None)
            } else {
                c.strip_prefix("score_")
                    .and_then(|n| n.parse::<u8>().ok())
                    .filter(|n| *n <= 10)
                    .map(Some)
                    .ok_or_else(|| invalid(key))
            }
        };
        Ok(
            json!({"grammar":score("grammar")?,"conversation":score("conversation")?,"answers":answers}),
        )
    }
}

#[cfg(test)]
#[path = "message_assessment_tests.rs"]
mod tests;
