//! Model output is candidate evidence; exact source, construct membership and
//! repair semantics are checked before deterministic policy can publish it.
use crate::ai::transport::provider::Completion;
use crate::learning::coaching::*;
use crate::model::*;
use rusqlite::{Connection, params};
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
pub(crate) fn schema(captured: &Value, retry: bool) -> Result<Value> {
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
    let mut result = json!({"type":"object","additionalProperties":false,"required":["meaning_recovered","items"],"properties":{"meaning_recovered":{"type":"string","enum":["full","partial","none"]},"items":{"type":"array","items":item}}});
    if retry {
        result["required"] = json!(["repaired", "meaning_recovered", "items"]);
        result["properties"]["repaired"] = json!({"type":"boolean"});
    }
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
    if kind == "coach_retry_check" {
        let prior = captured["coachRetry"]["previousTurnId"]
            .as_str()
            .ok_or_else(|| rejected("missing retry provenance"))?;
        let linked: bool = db.query_row(
            "SELECT EXISTS(SELECT 1 FROM turns WHERE id=?1 AND replaces_turn_id=?2)",
            params![turn, prior],
            |r| r.get(0),
        )?;
        if !linked {
            return Err(rejected("retry source replaced or missing"));
        }
    }
    let source: String = db.query_row(
        "SELECT text FROM messages WHERE turn_id=?1 AND role='user'",
        [turn],
        |r| r.get(0),
    )?;
    validate_captured(&captured, &source, kind, output)
}

/// Validate an immutable execution input; publication separately checks current ownership.
pub(crate) fn validate_captured(
    captured: &Value,
    source: &str,
    kind: &str,
    output: &Completion,
) -> Result<Value> {
    if output.finish_reason == "error" {
        return Err(rejected("provider reported an error"));
    }
    if output.text.len() > 32768 {
        return Err(rejected("output exceeds 32768 bytes"));
    }
    let retry = kind == "coach_retry_check";
    let (mut observation, mut repaired) = if retry {
        let result: RetryCheck = crate::diagnostics::structured::decode(
            &output.text,
            &schema(captured, true)?,
            "Coach observation rejected",
        )?;
        (
            CoachObservation {
                meaning_recovered: result.meaning_recovered,
                items: result.items,
            },
            Some(result.repaired),
        )
    } else {
        (
            crate::diagnostics::structured::decode::<CoachObservation>(
                &output.text,
                &schema(captured, false)?,
                "Coach observation rejected",
            )?,
            None,
        )
    };
    let help_move = crate::learning::coaching::coach_policy::requested_move(captured)?;
    let candidates = captured["candidateConstructs"]
        .as_array()
        .ok_or_else(|| rejected("missing candidates"))?;
    for item in &observation.items {
        if !candidates.iter().any(|c| c["id"] == item.construct) {
            return Err(rejected("unknown construct"));
        }
        prose("quote", &item.quote)?;
        if !item.rationale.is_empty() {
            prose("rationale", &item.rationale)?;
        }
        if !source.contains(&item.quote) {
            return Err(rejected("quote not in exact learner source"));
        }
        if let Some(error) = &item.error {
            if matches!(item.outcome, Outcome::Demonstrated | Outcome::NotObserved) {
                return Err(rejected("outcome conflicts with error"));
            }
            prose("target_hypothesis", &error.target_hypothesis)?;
            if help_move == CoachMove::Explicit {
                prose("rationale", &item.rationale)?;
            }
            prose("error category", &error.category)?;
            if error.category.chars().count() > 80 {
                return Err(rejected("error category exceeds 80 characters"));
            }
            for (field, cue) in [
                ("hint", &error.hint),
                ("elicitation", &error.elicitation),
                ("metalinguistic", &error.metalinguistic),
            ] {
                let active = match field {
                    "hint" => help_move == CoachMove::Hint,
                    "elicitation" => {
                        matches!(help_move, CoachMove::Elicit | CoachMove::PartnerClarify)
                    }
                    _ => help_move == CoachMove::Metalinguistic,
                };
                if !active {
                    continue;
                }
                prose(field, cue)?;
            }
        }
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
    if repaired.is_some() {
        let construct = captured["coachRetry"]["item"]["construct"]
            .as_str()
            .ok_or_else(|| rejected("missing retry construct"))?;
        let unchanged_target = observation.items.iter().any(|i| {
            i.construct == construct
                && crate::learning::coaching::coach_policy::unchanged_correction(i)
        });
        if unchanged_target {
            // An unchanged proposal cannot establish repair. Retain all original
            // observations; the projection marks this target uncertain.
            repaired = Some(false);
        }
    }
    let native_repair = if repaired == Some(true) {
        let target = captured["coachRetry"]["item"]["construct"]
            .as_str()
            .ok_or_else(|| rejected("missing retry target"))?;
        observation.items.iter().find(|i| {
            i.construct == target && i.outcome == Outcome::Demonstrated && i.error.is_none()
        }).map(|item| json!({"construct":target,"quote":item.quote,"outcome":"demonstrated","source":"native_repair_check","support_step":captured["coachRetry"]["supportStep"]}))
    } else {
        None
    };
    let decision =
        crate::learning::coaching::coach_policy::decide(captured, &observation, repaired)?;
    Ok(
        json!({"observation":observation,"decision":decision,"repaired":repaired,"nativeRepair":native_repair}),
    )
}
pub(crate) fn publish(db: &Connection, turn: &str, value: &Value, attempt: &str) -> Result<()> {
    db.execute("UPDATE turns SET context=json_set(context,'$.coachObservation',json(?2),'$.coachDecision',json(?3),'$.coachObservationAttempt',?4,'$.itemsReturned',?5,'$.nativeRepairObservation',json(?6)) WHERE id=?1",params![turn,value["observation"].to_string(),value["decision"].to_string(),attempt,value["observation"]["items"].as_array().ok_or_else(||rejected("missing validated items"))?.len() as i32,value["nativeRepair"].to_string()])?;
    // Correction feedback is independent of skill credit.
    let observation: CoachObservation = serde_json::from_value(value["observation"].clone())?;
    let omitted: Vec<usize> = observation
        .items
        .iter()
        .enumerate()
        .filter(|(_, item)| crate::learning::coaching::coach_policy::unchanged_correction(item))
        .map(|(index, _)| index)
        .collect();
    if !omitted.is_empty() {
        db.execute("UPDATE attempts SET diagnostics=json_set(COALESCE(diagnostics,'{}'),'$.coaching_display',json(?2)) WHERE id=?1",
            params![attempt,json!({"reason":"unchanged_replacement","omitted_item_indices":omitted,"original_observations_retained":true}).to_string()])?;
    }
    Ok(())
}

#[cfg(test)]
mod text_contract_tests {
    use super::*;
    #[test]
    fn revisions_keep_current_feedback_when_repair_judgment_and_previous_skill_differ() {
        let mut context = captured();
        context["candidateConstructs"] = json!([{"id":"question"},{"id":"possession"}]);
        context["coachRetry"] =
            json!({"item":{"construct":"question"},"shown":{"move":"explicit"},"depth":1});
        let new_issue = json!({"construct":"possession","quote":"source","outcome":"partial","rationale":"Current correction","error":{"op":"replace","category":"grammar","source":"unknown","blocks_meaning":false,"target_hypothesis":"replacement","hint":"","elicitation":"","metalinguistic":""}});
        for reported in [false, true] {
            for prior_outcome in [None, Some("demonstrated"), Some("partial")] {
                let mut items = vec![new_issue.clone()];
                if let Some(outcome) = prior_outcome {
                    items.push(json!({"construct":"question","quote":"source","outcome":outcome,"error":null,"rationale":""}));
                }
                let output = Completion {
                    text: json!({"repaired":reported,"meaning_recovered":"full","items":items})
                        .to_string(),
                    finish_reason: "stop".into(),
                    actual_model: "fixture".into(),
                    provider_id: "fixture".into(),
                    input_tokens: None,
                    output_tokens: None,
                    diagnostics: None,
                };
                let result =
                    validate_captured(&context, "source", "coach_retry_check", &output).unwrap();
                assert_eq!(result["repaired"], reported);
                assert_eq!(result["observation"]["items"], json!(items));
                assert_eq!(result["decision"]["shown"]["construct"], "possession");
                if !reported || prior_outcome != Some("demonstrated") {
                    assert!(result["nativeRepair"].is_null());
                }
                let mut disclosed = context.clone();
                disclosed["coachObservation"] = result["observation"].clone();
                disclosed["coachDecision"] = result["decision"].clone();
                disclosed["coachDecision"]["exposedMove"] = json!("explicit");
                let view = coach_policy::view(&disclosed).unwrap().unwrap();
                assert_eq!(view.corrections.len(), 1);
                assert_eq!(view.corrections[0].text, "replacement");
            }
        }
    }

    fn captured() -> Value {
        json!({"candidateConstructs":[{"id":"question"}],"practiceSettings":{"coachProactivity":"on_request"},"feedbackPolicy":crate::configuration::Registry::bundled().unwrap().feedback_policy()})
    }
    #[test]
    fn unchanged_replacement_preserves_other_corrections_and_original_observations() {
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
        assert_eq!(result["observation"], raw);
        assert_eq!(result["decision"]["shown"]["text"], "replacement 0");
        let mut saved = context;
        saved["coachObservation"] = result["observation"].clone();
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
        assert_eq!(view.items_returned, 9);
        db.execute_batch("CREATE TABLE attempts(id TEXT, diagnostics TEXT); INSERT INTO attempts VALUES('a','{}');").unwrap();
        publish(&db, "t", &result, "a").unwrap();
        let diagnostics: String = db
            .query_row("SELECT diagnostics FROM attempts WHERE id='a'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(
            serde_json::from_str::<Value>(&diagnostics).unwrap()["coaching_display"]["omitted_item_indices"],
            json!([0])
        );
        db.execute_batch("ALTER TABLE turns ADD COLUMN replaces_turn_id TEXT; UPDATE turns SET replaces_turn_id='prior' WHERE id='t';").unwrap();
        saved["coachRetry"] = json!({"previousTurnId":"prior","item":{"construct":"question"},"shown":{"move":"explicit"},"supportStep":null});
        db.execute(
            "UPDATE turns SET context=?1 WHERE id='t'",
            [saved.to_string()],
        )
        .unwrap();
        let output = Completion {
            text: json!({"meaning_recovered":"full","repaired":true,"items":[make("source")]})
                .to_string(),
            ..output
        };
        let result = validate(&db, "t", "coach_retry_check", &output).unwrap();
        assert_eq!(result["repaired"], false);
        assert!(result["nativeRepair"].is_null());
        assert_eq!(result["decision"]["repairStatus"], "uncertain");
    }
    #[test]
    fn generation_requests_concise_help_without_rejecting_longer_usable_text() {
        let schema = schema(&captured(), false).unwrap();
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
        let schema = schema(&captured(), false).unwrap();
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
