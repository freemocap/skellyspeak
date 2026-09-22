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
fn extra_help_longer_text_and_unused_cues_do_not_discard_coaching() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    let mut output = json!({"meaning_recovered":"full","items":[candidate("greeting","Hola","Use hola as a greeting."),candidate("question","¿cómo estás?","")]});
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][1]["rationale"] = json!("Another tip.");
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][1]["rationale"] = json!("");
    output["items"][0]["rationale"] = json!("x".repeat(161));
    assert!(validate(&store, &turn, &output).is_ok());
    let mut output = json!({"meaning_recovered":"partial","items":[wave2_error("¿cómo estás?")]});
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][0]["error"]["elicitation"] = json!("Unused extra help.");
    assert!(validate(&store, &turn, &output).is_ok());
    output["extra_provider_note"] = json!("ignored display preference");
    output["items"][0]["extra_provider_note"] = json!(true);
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][0]["quote"] = json!("not in the learner message");
    assert!(validate(&store, &turn, &output).is_err());
}
