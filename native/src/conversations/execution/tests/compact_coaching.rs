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
fn silent_coaching_is_successful_and_preserves_evidence_credit() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    store.dispatch().unwrap();
    let _persona = store.dispatch().unwrap().unwrap();
    let feedback = store.dispatch().unwrap().unwrap();
    let data: Value = serde_json::from_str(&feedback.messages[1].content).unwrap();
    assert!(
        data["candidateConstructs"]
            .as_array()
            .unwrap()
            .iter()
            .all(|c| c.as_object().unwrap().len() == 2)
    );
    assert!(
        !feedback.messages[0]
            .content
            .contains("Create natural moments")
    );
    assert!(feedback.messages[0].content.contains("ZERO OR ONE"));
    let bytes = feedback
        .messages
        .iter()
        .map(|message| message.content.len())
        .sum::<usize>();
    assert!(
        bytes < 12000,
        "Short-turn coaching prompt grew to {bytes} bytes"
    );
    println!("Compact coaching fixture: {bytes} message-content bytes");
    let empty = validate(
        &store,
        &turn,
        &json!({"meaning_recovered":"full","items":[]}),
    )
    .unwrap();
    assert!(empty["decision"]["shown"].is_null());
    let evidence = json!({"meaning_recovered":"full","items":[candidate("greeting","Hola",""),candidate("question","¿cómo estás?","")]});
    store
        .finish(&feedback, Ok(reply(&evidence.to_string())))
        .unwrap();
    let state: String = store
        .connection
        .query_row(
            "SELECT state FROM attempts WHERE id=?1",
            [&feedback.attempt],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(state, "succeeded");
    let captured = wave2_context(&store, &turn);
    assert_eq!(
        captured["coachObservation"]["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
    assert!(captured["coachDecision"]["shown"].is_null());
    assert!(captured["coachDecision"]["fixed"].is_null());
    let progress = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert!(progress["profile"]["xp"].as_i64().unwrap() > 0);
}

#[test]
fn one_short_tip_is_valid_but_extra_help_and_unused_cues_are_rejected() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    let mut output = json!({"meaning_recovered":"full","items":[candidate("greeting","Hola","Use hola as a greeting."),candidate("question","¿cómo estás?","")]});
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][1]["rationale"] = json!("Another tip.");
    assert!(
        validate(&store, &turn, &output)
            .unwrap_err()
            .message
            .contains("more than one coaching suggestion")
    );
    output["items"][1]["rationale"] = json!("");
    output["items"][0]["rationale"] = json!("x".repeat(161));
    assert!(
        validate(&store, &turn, &output)
            .unwrap_err()
            .message
            .contains("exceeds 160")
    );
    let mut output = json!({"meaning_recovered":"partial","items":[wave2_error("¿cómo estás?")]});
    assert!(validate(&store, &turn, &output).is_ok());
    output["items"][0]["error"]["elicitation"] = json!("Unused extra help.");
    assert!(
        validate(&store, &turn, &output)
            .unwrap_err()
            .message
            .contains("unused coaching cue")
    );
}

#[test]
fn empty_observation_publishes_success_without_advice_or_credit() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    store.dispatch().unwrap();
    let _persona = store.dispatch().unwrap().unwrap();
    let feedback = store.dispatch().unwrap().unwrap();
    store
        .finish(
            &feedback,
            Ok(reply(r#"{"meaning_recovered":"full","items":[]}"#)),
        )
        .unwrap();
    let captured = wave2_context(&store, &turn);
    assert_eq!(captured["coachObservation"]["items"], json!([]));
    assert!(captured["coachDecision"]["shown"].is_null());
    assert!(captured["coach_feedbackError"].is_null());
    let state: String = store
        .connection
        .query_row(
            "SELECT state FROM attempts WHERE id=?1",
            [&feedback.attempt],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(state, "succeeded");
    let progress = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(progress["profile"]["xp"], 0);
}
