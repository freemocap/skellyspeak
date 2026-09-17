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
    let error = json!({"type":["object","null"],"additionalProperties":false,"required":["op","category","source","blocks_meaning","target_hypothesis","hint","elicitation","metalinguistic"],"properties":{"op":{"type":"string","enum":["missing","replace","unnecessary"]},"category":{"type":"string","minLength":1,"maxLength":80,"pattern":"^[A-Za-z0-9=_|\\-]+$"},"source":{"type":"string","enum":["transfer","developmental","slip","unknown"]},"blocks_meaning":{"type":"boolean"},"target_hypothesis":text_schema(TARGET_LIMIT),"hint":cue_schema(help_move == CoachMove::Hint),"elicitation":cue_schema(matches!(help_move, CoachMove::Elicit | CoachMove::PartnerClarify)),"metalinguistic":cue_schema(help_move == CoachMove::Metalinguistic)}});
    let item = json!({"type":"object","additionalProperties":false,"required":["construct","quote","outcome","error","rationale"],"properties":{"construct":{"type":"string","enum":ids},"quote":text_schema(QUOTE_LIMIT),"outcome":{"type":"string","enum":Outcome::ALL},"error":error,"rationale":{"type":"string","maxLength":RATIONALE_LIMIT}}});
    let mut result = json!({"type":"object","additionalProperties":false,"required":["meaning_recovered","items"],"properties":{"meaning_recovered":{"type":"string","enum":["full","partial","none"]},"items":{"type":"array","maxItems":6,"items":item}}});
    if retry {
        result["required"] = json!(["repaired", "meaning_recovered", "items"]);
        result["properties"]["repaired"] = json!({"type":"boolean"});
    }
    Ok(result)
}
fn prose(field: &str, text: &str, max: usize) -> Result<()> {
    if text.trim().is_empty() {
        return Err(rejected(&format!("{field} is empty")));
    }
    if text.chars().count() > max {
        return Err(rejected(&format!("{field} exceeds {max} characters")));
    }
    crate::ai::transport::provider::validate_prose(text)
}
fn leaks_answer(cue: &str, target: &str) -> bool {
    let cue = cue.to_lowercase();
    let target = target.to_lowercase();
    if target.chars().all(|c| c.is_ascii_alphabetic()) && target.len() <= 3 {
        cue.split(|c: char| !c.is_alphabetic())
            .any(|word| word == target)
    } else {
        cue.contains(&target)
    }
}
pub(crate) fn validate(
    db: &Connection,
    turn: &str,
    kind: &str,
    output: &Completion,
) -> Result<Value> {
    if output.finish_reason != "stop" {
        return Err(rejected("non-normal completion"));
    }
    if output.text.len() > 32768 {
        return Err(rejected("output exceeds 32768 bytes"));
    }
    let raw: String = db.query_row("SELECT context FROM turns WHERE id=?1", [turn], |r| {
        r.get(0)
    })?;
    let captured: Value = serde_json::from_str(&raw)?;
    let retry = kind == "coach_retry_check";
    let (observation, repaired) = if retry {
        let result: RetryCheck = crate::diagnostics::structured::decode(
            &output.text,
            &schema(&captured, true)?,
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
                &schema(&captured, false)?,
                "Coach observation rejected",
            )?,
            None,
        )
    };
    if observation
        .items
        .iter()
        .filter(|item| item.error.is_some() || !item.rationale.is_empty())
        .count()
        > 1
    {
        return Err(rejected("more than one coaching suggestion"));
    }
    let help_move = crate::learning::coaching::coach_policy::requested_move(&captured)?;
    if observation.items.len() > 6 {
        return Err(rejected("item count"));
    }
    let source: String = db.query_row(
        "SELECT text FROM messages WHERE turn_id=?1 AND role='user'",
        [turn],
        |r| r.get(0),
    )?;
    let candidates = captured["candidateConstructs"]
        .as_array()
        .ok_or_else(|| rejected("missing candidates"))?;
    let mut seen = std::collections::HashSet::new();
    for item in &observation.items {
        if !candidates.iter().any(|c| c["id"] == item.construct) || !seen.insert(&item.construct) {
            return Err(rejected("unknown or duplicate construct"));
        }
        prose("quote", &item.quote, QUOTE_LIMIT)?;
        if !item.rationale.is_empty() {
            prose("rationale", &item.rationale, RATIONALE_LIMIT)?;
        }
        if !source.contains(&item.quote) {
            return Err(rejected("quote not in exact learner source"));
        }
        if let Some(error) = &item.error {
            if matches!(item.outcome, Outcome::Demonstrated | Outcome::NotObserved) {
                return Err(rejected("outcome conflicts with error"));
            }
            prose("target_hypothesis", &error.target_hypothesis, TARGET_LIMIT)?;
            if help_move == CoachMove::Explicit {
                prose("rationale", &item.rationale, RATIONALE_LIMIT)?;
                if error.target_hypothesis.trim() == item.quote.trim() {
                    return Err(rejected("correction must change the quoted wording"));
                }
            }
            if error.category.is_empty()
                || error.category.len() > 80
                || !error
                    .category
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || "=_|-".contains(c))
            {
                return Err(rejected("invalid error category"));
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
                    if !cue.is_empty() {
                        return Err(rejected("unused coaching cue must be empty"));
                    }
                    continue;
                }
                prose(field, cue, CUE_LIMIT)?;
                if leaks_answer(cue, &error.target_hypothesis) {
                    return Err(rejected("graduated cue reveals the answer"));
                }
            }
        }
    }
    if let Some(repaired) = repaired {
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
        let construct = captured["coachRetry"]["item"]["construct"]
            .as_str()
            .ok_or_else(|| rejected("missing retry construct"))?;
        let item = observation.items.iter().find(|i| i.construct == construct);
        let demonstrated =
            item.is_some_and(|i| i.outcome == Outcome::Demonstrated && i.error.is_none());
        if repaired != demonstrated {
            return Err(rejected("repair flag contradicts target evidence"));
        }
    }
    let native_repair = if repaired == Some(true) {
        if !candidates.iter().any(|c| c["id"] == "ix.self_repair") {
            return Err(rejected("self-repair construct missing from registry"));
        }
        let target = captured["coachRetry"]["item"]["construct"]
            .as_str()
            .ok_or_else(|| rejected("missing retry target"))?;
        let item = observation
            .items
            .iter()
            .find(|i| i.construct == target)
            .ok_or_else(|| rejected("missing repaired item"))?;
        Some(
            json!({"construct":"ix.self_repair","quote":item.quote,"outcome":"demonstrated","source":"native_repair_check","support_step":captured["coachRetry"]["supportStep"]}),
        )
    } else {
        None
    };
    let decision =
        crate::learning::coaching::coach_policy::decide(&captured, &observation, repaired)?;
    Ok(
        json!({"observation":observation,"decision":decision,"repaired":repaired,"nativeRepair":native_repair}),
    )
}
pub(crate) fn publish(db: &Connection, turn: &str, value: &Value, attempt: &str) -> Result<()> {
    db.execute("UPDATE turns SET context=json_set(context,'$.coachObservation',json(?2),'$.coachDecision',json(?3),'$.coachObservationAttempt',?4,'$.itemsReturned',?5,'$.nativeRepairObservation',json(?6)) WHERE id=?1",params![turn,value["observation"].to_string(),value["decision"].to_string(),attempt,value["observation"]["items"].as_array().ok_or_else(||rejected("missing validated items"))?.len() as i32,value["nativeRepair"].to_string()])?;
    crate::learning::rewards::publish(db, turn, attempt)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn short_answer_check_respects_word_boundaries() {
        assert!(!super::leaks_answer("Which article fits here?", "a"));
        assert!(super::leaks_answer("Use a here", "a"));
        assert!(super::leaks_answer("Try: I", "I"));
    }
}

#[cfg(test)]
mod text_contract_tests {
    use super::*;
    fn captured() -> Value {
        json!({"candidateConstructs":[{"id":"question"}],"practiceSettings":{"coachProactivity":"on_request"},"feedbackPolicy":crate::configuration::Registry::bundled().unwrap().feedback_policy()})
    }
    #[test]
    fn generation_and_validation_share_small_limits_and_direct_help() {
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
            assert!(prose(field, &"é".repeat(max), max).is_ok());
            assert!(prose(field, &"é".repeat(max + 1), max).is_err());
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
