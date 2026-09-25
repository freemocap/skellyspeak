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
    let first = candidate("questions_answers", "¿cómo estás?", "");
    let second = candidate("questions_answers", "cómo", "A separate observation.");
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
    output["items"][2]["quote"] = json!("not in the learner message");
    assert!(validate(&store, &turn, &output).is_err());
    output["items"][2] = first;
    output["items"][2]["construct"] = json!("unknown_skill");
    assert!(validate(&store, &turn, &output).is_err());
}

#[test]
fn extra_help_longer_text_and_unused_cues_do_not_discard_coaching() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    let mut output = json!({"meaning_recovered":"full","items":[candidate("questions_answers","¿cómo estás?","")]});
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
    assert!(validate(&store, &turn, &output).is_err());
}
