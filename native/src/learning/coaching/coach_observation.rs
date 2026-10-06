//! Validate observations of one message version before publishing source-owned results.
//! Partial usable feedback retains omission diagnostics; wholly unusable feedback fails.
use crate::ai::transport::provider::Completion;
use crate::learning::coaching::*;
use crate::model::*;
use rusqlite::Connection;
use serde_json::{Value, json};
mod response_guard;
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
    let mut target = text_schema(TARGET_LIMIT);
    target["description"] = json!(
        "One corrected replacement for the quoted span. Choose one wording; no alternatives, slash-separated options, explanations or repeated versions. Close this string after the replacement."
    );
    let mut error = json!({"type":["object","null"],"additionalProperties":false,"required":["op","category","source","blocks_meaning","target_hypothesis"],"properties":{"op":{"type":"string","enum":["missing","replace","unnecessary"]},"category":{"type":"string","minLength":1,"maxLength":80},"source":{"type":"string","enum":["unknown"]},"blocks_meaning":{"type":"boolean"},"target_hypothesis":target}});
    if let Some(field) = cue_field(&help_move) {
        error["properties"][field] = text_schema(CUE_LIMIT);
        error["required"].as_array_mut().unwrap().push(json!(field));
    }
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
fn cue_field(help_move: &CoachMove) -> Option<&'static str> {
    match help_move {
        CoachMove::Hint => Some("hint"),
        CoachMove::Elicit | CoachMove::PartnerClarify => Some("elicitation"),
        CoachMove::Metalinguistic => Some("metalinguistic"),
        _ => None,
    }
}

// The generation contract omits unused cues. Populate only those absent fields
// at this boundary; persisted observations retain their established shape, and
// older responses with all three fields remain accepted. Required active cues
// must still be returned by the provider.
fn decode_observation(text: &str, captured: &Value) -> Result<CoachObservation> {
    let mut schema = schema(captured)?;
    let mut value: Value =
        crate::diagnostics::structured::decode(text, &schema, "Coach observation rejected")?;
    let active = cue_field(&coach_policy::requested_move(captured)?);
    if let Some(items) = value.get_mut("items").and_then(Value::as_array_mut) {
        for item in items {
            if let Some(error) = item.get_mut("error").and_then(Value::as_object_mut) {
                for field in ["hint", "elicitation", "metalinguistic"] {
                    if Some(field) != active {
                        error.entry(field).or_insert_with(|| json!(""));
                    }
                }
            }
        }
    }
    // Inspect typed decoding against the normalized shape, so an unrelated
    // missing/invalid field is not masked by our inserted legacy cue fields.
    let error_schema = &mut schema["properties"]["items"]["items"]["properties"]["error"];
    for field in ["hint", "elicitation", "metalinguistic"] {
        if Some(field) != active {
            error_schema["properties"][field] = json!({"type":"string"});
            error_schema["required"]
                .as_array_mut()
                .unwrap()
                .push(json!(field));
        }
    }
    crate::diagnostics::structured::decode(
        &value.to_string(),
        &schema,
        "Coach observation rejected",
    )
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
    response_guard::complete(output)?;
    if output.finish_reason == "error" {
        return Err(rejected("provider reported an error"));
    }
    if output.text.len() > 32768 {
        return Err(rejected("output exceeds 32768 bytes"));
    }
    if kind != "coach_feedback" {
        return Err(rejected("unknown observation kind"));
    }
    let mut observation = decode_observation(&output.text, captured)?;
    let help_move = crate::learning::coaching::coach_policy::requested_move(captured)?;
    let candidates = captured["candidateConstructs"]
        .as_array()
        .ok_or_else(|| rejected("missing candidates"))?;
    // Observations are advice, not a contract: an item the policy cannot use is
    // left out and the rest of the coaching is kept. A quote that is not a
    // verbatim piece of the message is kept; the display marks only exact matches.
    let submitted_items = observation.items.len();
    let mut repetitive_items = 0usize;
    observation.items = std::mem::take(&mut observation.items)
        .into_iter()
        .filter_map(|mut item| {
            if response_guard::repetitive(&item.rationale)
                || item.error.as_ref().is_some_and(|error| {
                    response_guard::repetitive(&error.target_hypothesis)
                        || match cue_field(&help_move) {
                            Some("hint") => response_guard::repetitive(&error.hint),
                            Some("elicitation") => response_guard::repetitive(&error.elicitation),
                            Some("metalinguistic") => {
                                response_guard::repetitive(&error.metalinguistic)
                            }
                            _ => false,
                        }
                })
            {
                repetitive_items += 1;
                return None;
            }
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
                "omitted_items":validation_omissions, "reason":"unusable_assessment",
                "repetitive_items":repetitive_items
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
    fn malformed_shapes_are_rejected_without_panicking_or_leaking_content() {
        for text in ["null", "[]", "7", "\"PRIVATE_TEXT\"", "{\"items\":[7]}"] {
            let error = decode_observation(text, &captured()).unwrap_err();
            assert!(!error.message.contains("PRIVATE_TEXT"));
        }
    }
    #[test]
    fn slim_wire_contract_preserves_saved_shape_and_requires_the_active_cue() {
        for (mode, active) in [
            ("explicit", None),
            ("hint", Some("hint")),
            ("elicit", Some("elicitation")),
            ("partner_clarify", Some("elicitation")),
            ("metalinguistic", Some("metalinguistic")),
        ] {
            let mut context = captured();
            context["feedbackPolicy"]["intensity"]["light"]["start_at"] = json!(mode);
            let contract = schema(&context).unwrap();
            let properties =
                &contract["properties"]["items"]["items"]["properties"]["error"]["properties"];
            let mut value = json!({"meaning_recovered":"full","items":[{"construct":"question","quote":"source","outcome":"partial","rationale":"Explanation","error":{"op":"replace","category":"grammar","source":"unknown","blocks_meaning":false,"target_hypothesis":"replacement"}}]});
            for field in ["hint", "elicitation", "metalinguistic"] {
                assert_eq!(properties.get(field).is_some(), Some(field) == active);
            }
            if let Some(field) = active {
                assert!(decode_observation(&value.to_string(), &context).is_err());
                value["items"][0]["error"][field] = json!("Active help");
            }
            let decoded = decode_observation(&value.to_string(), &context).unwrap();
            let saved = serde_json::to_value(decoded).unwrap();
            for field in ["hint", "elicitation", "metalinguistic"] {
                assert_eq!(
                    saved["items"][0]["error"][field],
                    if Some(field) == active {
                        "Active help"
                    } else {
                        ""
                    }
                );
                value["items"][0]["error"][field] = json!("Legacy help");
            }
            let legacy = decode_observation(&value.to_string(), &context).unwrap();
            assert_eq!(legacy.items[0].error.as_ref().unwrap().hint, "Legacy help");
        }
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
            assert_eq!(item["error"]["properties"].get(field), None);
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
