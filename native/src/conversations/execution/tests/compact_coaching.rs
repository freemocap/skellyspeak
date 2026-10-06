use super::*;
use serde_json::{Value, json};

fn candidate(construct: &str, quote: &str, rationale: &str) -> Value {
    json!({"construct":construct,"quote":quote,"outcome":"demonstrated","error":null,"rationale":rationale})
}
fn validate(store: &Store, turn: &str, value: &Value) -> Result<Value> {
    crate::learning::coaching::coach_observation::validate(
        &store.connection,
        turn,
        "coach_feedback",
        &reply(&value.to_string()),
    )
}

#[test]
fn repeated_skills_keep_distinct_evidence_and_collapse_exact_repeats() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    let first = candidate("information_exchange", "¿cómo estás?", "");
    let second = candidate("information_exchange", "cómo", "A separate observation.");
    let mut output = json!({"meaning_recovered":"full","items":[first, second, first]});
    let validated = validate(&store, &turn, &output).unwrap();
    assert_eq!(validated["observation"]["items"], json!([first, second]));
    let correction = wave2_error("¿cómo estás?");
    let mixed = json!({"meaning_recovered":"full","items":[first, correction]});
    let validated = validate(&store, &turn, &mixed).unwrap();
    assert_eq!(
        validated["observation"]["items"].as_array().unwrap().len(),
        2
    );
    assert_eq!(validated["decision"]["shown"]["quote"], "¿cómo estás?");
    // A quote that is not verbatim from the message is kept, not a failure.
    output["items"][2]["quote"] = json!("not in the learner message");
    let loose = validate(&store, &turn, &output).unwrap();
    assert_eq!(
        loose["observation"]["items"][2]["quote"],
        "not in the learner message"
    );
    output["items"][2] = first.clone();
    // An item for a skill that was not asked about is dropped; the rest stays.
    output["items"][2]["construct"] = json!("unknown_skill");
    let kept = validate(&store, &turn, &output).unwrap();
    assert_eq!(kept["observation"]["items"], json!([first, second]));
}

#[test]
fn extra_help_longer_text_and_unused_cues_do_not_discard_coaching() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    let mut output = json!({"meaning_recovered":"full","items":[candidate("information_exchange","¿cómo estás?","")]});
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][0]["rationale"] = json!("Another tip.");
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][0]["rationale"] = json!("");
    output["items"][0]["rationale"] = json!("x".repeat(161));
    assert!(validate(&store, &turn, &output).is_ok());
    let mut output = json!({"meaning_recovered":"partial","items":[wave2_error("¿cómo estás?")]});
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][0]["error"]["category"] = json!("Past tense agreement");
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][0]["error"]["elicitation"] = json!("Unused extra help.");
    assert!(validate(&store, &turn, &output).is_ok());
    output["extra_provider_note"] = json!("ignored display preference");
    output["items"][0]["extra_provider_note"] = json!(true);
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][0]["quote"] = json!("not in the learner message");
    assert!(validate(&store, &turn, &output).is_ok());
}

#[test]
fn runaway_correction_is_omitted_without_losing_distinct_useful_feedback() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    let mut runaway = wave2_error("¿cómo estás?");
    runaway["error"]["target_hypothesis"] =
        json!("One replacement / Another replacement / ".repeat(100));
    let good = wave2_error("¿cómo estás?");
    let mixed = json!({"meaning_recovered":"full","items":[runaway, good]});
    let result = validate(&store, &turn, &mixed).unwrap();
    assert_eq!(result["validationOmissions"], 1);
    assert_eq!(result["observation"]["items"], json!([good]));
    let alone = json!({"meaning_recovered":"full","items":[runaway]});
    let error = validate(&store, &turn, &alone).unwrap_err();
    assert_eq!(error.diagnostics.unwrap()["repetitive_items"], 1);
}

#[test]
fn truncated_coaching_retains_response_and_usage_without_retries_or_publication() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    store
        .connection
        .execute(
            "DELETE FROM operations WHERE kind NOT IN ('persona_context','coach_feedback')",
            [],
        )
        .unwrap();
    store.dispatch().unwrap();
    let work = store.dispatch().unwrap().unwrap();
    let partial = "{\"items\":[{\"PRIVATE_UNFINISHED_TEXT";
    let mut output = reply(partial);
    output.finish_reason = "length".into();
    output.output_tokens = Some(8181);
    output.diagnostics = Some(
        json!({"id":"truncated-coach-receipt","choices":[{"finish_reason":"length","native_finish_reason":"MAX_TOKENS"}],"usage":{"completion_tokens":8181}}),
    );
    // A syntactically complete fragment is still incomplete provider output.
    let mut parseable = output.clone();
    parseable.text = json!({"meaning_recovered":"full","items":[]}).to_string();
    let context = wave2_context(&store, &turn);
    let error = crate::learning::coaching::coach_observation::validate_captured(
        &context,
        "coach_feedback",
        &parseable,
    )
    .unwrap_err();
    assert_eq!(error.diagnostics.unwrap()["reason"], "output_token_limit");
    store.finish(&work, Ok(output)).unwrap();
    let (state, error, response, tokens, details): (String, String, String, i32, String) = store
        .connection
        .query_row(
            "SELECT state,error,response_text,output_tokens,diagnostics FROM attempts WHERE id=?1",
            [&work.attempt],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .unwrap();
    assert_eq!(state, "failed");
    assert!(error.contains("output limit"));
    assert!(!error.contains("invalid_json"));
    assert_eq!(response, partial);
    assert_eq!(tokens, 8181);
    assert!(details.contains("truncated-coach-receipt"));
    assert!(details.contains("MAX_TOKENS"));
    assert!(!details.contains("PRIVATE_UNFINISHED_TEXT"));
    let captured = wave2_context(&store, &turn);
    assert!(captured.get("coachObservation").is_none());
    assert!(store.dispatch().unwrap().is_none());
}
