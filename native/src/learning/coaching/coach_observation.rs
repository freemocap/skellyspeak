//! Validate observations of one message version before publishing source-owned results.
//! Partial usable feedback retains omission diagnostics; wholly unusable feedback fails.
use crate::ai::transport::provider::Completion;
use crate::learning::coaching::*;
use crate::model::*;
use rusqlite::Connection;
use serde_json::{Value, json};
fn rejected(reason: &str) -> AppError {
    AppError::new(
        ErrorCode::Validation,
        format!("Coach observation rejected: {reason}."),
    )
}
const QUOTE_LIMIT: usize = 160;
const RATIONALE_LIMIT: usize = 160;
const TARGET_LIMIT: usize = 160;
const CUE_LIMIT: usize = 160;
fn text_schema(max: usize) -> Value {
    json!({"type":"string", "minLength":1, "maxLength":max})
}
pub(crate) fn schema(captured: &Value) -> Result<Value> {
    let ids: Vec<Value> = captured["candidateConstructs"]
        .as_array()
        .ok_or_else(|| rejected("missing candidates"))?
        .iter()
        .map(|c| c["id"].clone())
        .collect();
    if ids.is_empty() {
        return Err(rejected("empty candidates"));
    }
    let help_move = crate::learning::coaching::coach_policy::requested_move(captured)?;
    let cue_schema = |active: bool| {
        if active {
            text_schema(CUE_LIMIT)
        } else {
            json!({"type":"string","const":""})
        }
    };
    let error = json!({"type":["object","null"],"additionalProperties":false,"required":["op","category","source","blocks_meaning","target_hypothesis","hint","elicitation","metalinguistic"],"properties":{"op":{"type":"string","enum":["missing","replace","unnecessary"]},"category":{"type":"string","minLength":1,"maxLength":80},"source":{"type":"string","enum":["transfer","developmental","slip","unknown"]},"blocks_meaning":{"type":"boolean"},"target_hypothesis":text_schema(TARGET_LIMIT),"hint":cue_schema(help_move == CoachMove::Hint),"elicitation":cue_schema(matches!(help_move, CoachMove::Elicit | CoachMove::PartnerClarify)),"metalinguistic":cue_schema(help_move == CoachMove::Metalinguistic)}});
    let item = json!({"type":"object","additionalProperties":false,"required":["construct","quote","outcome","error","rationale"],"properties":{"construct":{"type":"string","enum":ids},"quote":text_schema(QUOTE_LIMIT),"outcome":{"type":"string","enum":Outcome::ALL},"error":error,"rationale":{"type":"string","maxLength":RATIONALE_LIMIT}}});
    let result = json!({"type":"object","additionalProperties":false,"required":["meaning_recovered","items"],"properties":{"meaning_recovered":{"type":"string","enum":["full","partial","none"]},"items":{"type":"array","items":item}}});
    Ok(result)
}
fn prose(field: &str, text: &str) -> Result<()> {
    if text.trim().is_empty() {
        return Err(rejected(&format!("{field} is empty")));
    }
    crate::ai::transport::provider::validate_prose(text)
}
pub(crate) fn validate(
    db: &Connection,
    turn: &str,
    kind: &str,
    output: &Completion,
) -> Result<Value> {
    let raw: String = db.query_row("SELECT context FROM turns WHERE id=?1", [turn], |r| {
        r.get(0)
    })?;
    let captured: Value = serde_json::from_str(&raw)?;
    validate_captured(&captured, kind, output)
}

/// Validate an immutable execution input; publication separately checks current ownership.
pub(crate) fn validate_captured(
    captured: &Value,
    kind: &str,
    output: &Completion,
) -> Result<Value> {
    if output.finish_reason == "error" {
        return Err(rejected("provider reported an error"));
    }
    if output.text.len() > 32768 {
        return Err(rejected("output exceeds 32768 bytes"));
    }
    if kind != "coach_feedback" && kind != "coach_reaction" {
        return Err(rejected("unknown observation kind"));
    }
    let mut observation = crate::diagnostics::structured::decode::<CoachObservation>(
        &output.text,
        &schema(captured)?,
        "Coach observation rejected",
    )?;
    let help_move = crate::learning::coaching::coach_policy::requested_move(captured)?;
    let candidates = captured["candidateConstructs"]
        .as_array()
        .ok_or_else(|| rejected("missing candidates"))?;
    // Observations are advice, not a contract: an item the policy cannot use is
    // left out and the rest of the coaching is kept. A quote that is not a
    // verbatim piece of the message is kept; the display marks only exact matches.
    let submitted_items = observation.items.len();
    observation.items = std::mem::take(&mut observation.items)
        .into_iter()
        .filter_map(|mut item| {
            if !candidates.iter().any(|c| c["id"] == item.construct)
                || prose("quote", &item.quote).is_err()
                || (!item.rationale.is_empty() && prose("rationale", &item.rationale).is_err())
            {
                return None;
            }
            // An error on something judged demonstrated or unobserved is the
            // model contradicting itself; the judgment stands without the error.
            if matches!(item.outcome, Outcome::Demonstrated | Outcome::NotObserved) {
                item.error = None;
            }
            if let Some(error) = &item.error {
                let cue = match help_move {
                    CoachMove::Hint => Some(&error.hint),
                    CoachMove::Elicit | CoachMove::PartnerClarify => Some(&error.elicitation),
                    CoachMove::Metalinguistic => Some(&error.metalinguistic),
                    _ => None,
                };
                let usable = prose("target_hypothesis", &error.target_hypothesis).is_ok()
                    && prose("error category", &error.category).is_ok()
                    && (help_move != CoachMove::Explicit
                        || prose("rationale", &item.rationale).is_ok())
                    && cue.is_none_or(|text| prose("cue", text).is_ok());
                if !usable {
                    return None;
                }
            }
            if crate::learning::coaching::coach_policy::unchanged_correction(&item) {
                return None;
            }
            Some(item)
        })
        .collect();
    let validation_omissions = submitted_items - observation.items.len();
    if submitted_items > 0 && observation.items.is_empty() {
        return Err(
            rejected("no usable assessment items").with_diagnostics(json!({
                "stage":"coach_observation_validation", "submitted_items":submitted_items,
                "omitted_items":validation_omissions, "reason":"unusable_assessment"
            })),
        );
    }
    // A skill can occur in several passages. Only identical observations are
    // redundant; validate all evidence before collapsing those repeats.
    let mut seen = std::collections::HashSet::new();
    let mut items = Vec::new();
    for item in observation.items {
        if seen.insert(serde_json::to_string(&item)?) {
            items.push(item);
        }
    }
    observation.items = items;
    let decision = crate::learning::coaching::coach_policy::decide(captured, &observation)?;
    Ok(
        json!({"observation":observation,"decision":decision,"validationOmissions":validation_omissions}),
    )
}

#[cfg(test)]
mod text_contract_tests {
    use super::*;
    fn captured() -> Value {
        json!({"candidateConstructs":[{"id":"question"}],"practiceSettings":{"coachProactivity":"on_request"},"feedbackPolicy":crate::configuration::Registry::bundled().unwrap().feedback_policy()})
    }
    #[test]
    fn unchanged_replacement_is_omitted_without_losing_other_corrections() {
        let db = Connection::open_in_memory().unwrap();
        db.execute_batch("CREATE TABLE turns(id TEXT, context TEXT); CREATE TABLE messages(turn_id TEXT,role TEXT,text TEXT);").unwrap();
        let context = captured();
        db.execute("INSERT INTO turns VALUES('t',?1)", [context.to_string()])
            .unwrap();
        db.execute("INSERT INTO messages VALUES('t','user','source')", [])
            .unwrap();
        let make = |target: &str| json!({"construct":"question","quote":"source","outcome":"partial","rationale":"Explanation","error":{"op":"replace","category":"grammar","source":"unknown","blocks_meaning":false,"target_hypothesis":target,"hint":"","elicitation":"","metalinguistic":""}});
        let mut items = vec![make("source")];
        for n in 0..8 {
            items.push(make(&format!("replacement {n}")));
        }
        let raw = json!({"meaning_recovered":"full","items":items});
        let output = Completion {
            text: raw.to_string(),
            finish_reason: "stop".into(),
            actual_model: "fixture".into(),
            provider_id: "fixture".into(),
            input_tokens: None,
            output_tokens: None,
            diagnostics: None,
        };
        let result = validate(&db, "t", "coach_feedback", &output).unwrap();
        assert_eq!(result["observation"]["items"].as_array().unwrap().len(), 8);
        assert_eq!(result["decision"]["shown"]["text"], "replacement 0");
        let mut saved = context;
        saved["coachObservation"] = result["observation"].clone();
        saved["coachValidationOmissions"] = result["validationOmissions"].clone();
        saved["coachDecision"] = result["decision"].clone();
        assert!(
            coach_policy::view(&saved)
                .unwrap()
                .unwrap()
                .corrections
                .is_empty()
        );
        saved["coachDecision"]["exposedMove"] = json!("explicit");
        let view = coach_policy::view(&saved).unwrap().unwrap();
        assert_eq!(view.corrections.len(), 8);
        assert_eq!(view.notes.len(), 1);
        assert_eq!(view.items_returned, 8);
    }
    #[test]
    fn generation_requests_concise_help_without_rejecting_longer_usable_text() {
        let schema = schema(&captured()).unwrap();
        let item = &schema["properties"]["items"]["items"]["properties"];
        assert_eq!(item["quote"], text_schema(QUOTE_LIMIT));
        assert_eq!(
            item["rationale"],
            json!({"type":"string","maxLength":RATIONALE_LIMIT})
        );
        for field in ["hint", "elicitation", "metalinguistic"] {
            assert_eq!(
                item["error"]["properties"][field],
                json!({"type":"string","const":""})
            );
        }
        for (field, max) in [
            ("quote", QUOTE_LIMIT),
            ("rationale", RATIONALE_LIMIT),
            ("hint", CUE_LIMIT),
        ] {
            assert!(prose(field, &"é".repeat(max)).is_ok());
            assert!(prose(field, &"é".repeat(max + 1)).is_ok());
        }
    }
    #[test]
    fn response_schema_outcomes_and_nullable_errors_match_rust() {
        let schema = schema(&captured()).unwrap();
        for outcome in Outcome::ALL {
            let value = json!({"meaning_recovered":"full","items":[{"construct":"question","quote":"hello","outcome":outcome,"error":null,"rationale":""}]});
            crate::diagnostics::structured::decode::<CoachObservation>(
                &value.to_string(),
                &schema,
                "Coach observation rejected",
            )
            .unwrap();
        }
        let bad = json!({"meaning_recovered":"full","items":[{"construct":"question","quote":"hello","outcome":"PRIVATE_ENUM","error":null,"rationale":""}]});
        let error = crate::diagnostics::structured::decode::<CoachObservation>(
            &bad.to_string(),
            &schema,
            "Coach observation rejected",
        )
        .unwrap_err();
        assert!(error.message.contains("$.items[0].outcome"));
        assert!(!error.message.contains("PRIVATE_ENUM"));
    }
}
