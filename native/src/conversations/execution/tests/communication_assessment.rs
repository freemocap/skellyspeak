//! Eight-group fixtures exercise dispatch, validation and credit transactions.
//! Level/reward publication is outside these focused credit tests.
//! Provider answers are controlled fixtures, not linguistic quality evaluations.
use super::*;
use serde_json::{Value, json};

fn prepare(store: &mut Store, conversation: &str, text: &str) -> String {
    let mut command = send(store, conversation);
    if let Action::SendMessage { text: source, .. } = &mut command.action {
        *source = text.into();
    }
    let turn = store.execute(command).unwrap().entity_id;
    capture(store, &turn);
    turn
}

fn capture(store: &Store, turn: &str) {
    let mut captured = wave2_context(store, turn);
    captured["presenceSkills"] = serde_json::to_value(
        store
            .config
            .communication_prompts("spanish", "spanish-spain", "english")
            .unwrap(),
    )
    .unwrap();
    captured["skillContentHash"] = json!(store.config.communication_content_hash());
    store
        .connection
        .execute(
            "UPDATE turns SET context=?2 WHERE id=?1",
            params![turn, captured.to_string()],
        )
        .unwrap();
}

fn observation(store: &Store, turn: &str) -> Value {
    wave2_context(store, turn)["practiceObservation"].clone()
}

fn publish_credit(store: &mut Store, turn: &str, work: &Dispatch, response: &Completion) -> Value {
    let validated = crate::learning::coaching::assessment_adapter::validate(
        &store.connection,
        turn,
        response,
        AssessmentAdapter::JevChoice,
    )
    .unwrap();
    let presence: std::collections::BTreeMap<String, crate::learning::practice::Presence> =
        serde_json::from_value(validated["presence"].clone()).unwrap();
    let ids = presence.keys().cloned().collect();
    let tx = store.connection.transaction().unwrap();
    crate::learning::practice::publish(&tx, turn, &work.attempt, presence, &ids).unwrap();
    tx.commit().unwrap();
    validated
}

fn complete_credit_fixture(store: &Store, turn: &str) {
    store
        .connection
        .execute(
            "UPDATE operations SET state='succeeded' WHERE turn_id=?1",
            [turn],
        )
        .unwrap();
    store
        .connection
        .execute("UPDATE turns SET state='succeeded' WHERE id=?1", [turn])
        .unwrap();
}

#[test]
fn correct_use_prompt_reaches_dispatch_and_gate_controls_group_credit() {
    let (_dir, mut store, conversation) = setup();
    let turn = prepare(
        &mut store,
        &conversation,
        "Ayer fui al mercado. ¿Puedes ayudarme?",
    );
    let work = skill_assessment::assessment(&mut store, &turn);
    let request = work.decisions.as_ref().unwrap();
    assert_eq!(
        request["state"]["currentLearnerMessage"],
        "Ayer fui al mercado. ¿Puedes ayudarme?"
    );
    assert_eq!(request["questions"].as_object().unwrap().len(), 10);
    let instruction = request["questions"]["time_events"]["instructions"]
        .as_str()
        .unwrap();
    assert!(instruction.contains("Ayer yo ir al mercado"));
    assert!(
        instruction
            .contains("Do not count a use when the learner gets the relevant construction wrong.")
    );
    assert_eq!(
        wave2_context(&store, &turn)["presenceInstructions"],
        serde_json::to_value(store.config.assessment_instructions()).unwrap()
    );

    let mut result = skill_assessment::presence(
        &work,
        &[
            ("time_events", "direct"),
            ("coordinating_action", "contextual"),
            ("information_exchange", "direct"),
            ("managing_conversation", "unclear"),
        ],
    );
    let mut answers: Value = serde_json::from_str(&result.text).unwrap();
    answers["time_events"]["probabilities"] =
        json!({"direct":0.4,"contextual":0.2,"absent":0.3,"unclear":0.1});
    answers["information_exchange"]["probabilities"] =
        json!({"direct":0.3,"contextual":0.29,"absent":0.31,"unclear":0.1});
    answers["managing_conversation"]["probabilities"] =
        json!({"direct":0.6,"contextual":0.2,"absent":0.1,"unclear":0.1});
    result.text = answers.to_string();
    let assessment = publish_credit(&mut store, &turn, &work, &result);
    let saved = observation(&store, &turn);
    let credits = saved["credits"].as_array().unwrap();
    assert_eq!(credits.len(), 2);
    assert!(credits.iter().all(|c| c["xp"] == 1 && c["experience"] == 1));
    assert!(credits.iter().any(|c| c["skillId"] == "time_events"));
    assert!(
        credits
            .iter()
            .any(|c| c["skillId"] == "coordinating_action")
    );
    assert_eq!(
        assessment["answers"]["information_exchange"]["probabilities"]["contextual"],
        0.29
    );
    assert_eq!(assessment["presence"]["information_exchange"], "absent");
    assert_eq!(assessment["presence"]["managing_conversation"], "unclear");
    publish_credit(&mut store, &turn, &work, &result);
    assert_eq!(observation(&store, &turn), saved);
}

#[test]
fn subskill_response_is_rejected_without_partial_credit() {
    let (_dir, mut store, conversation) = setup();
    let turn = prepare(&mut store, &conversation, "Ayer fui al mercado.");
    let work = skill_assessment::assessment(&mut store, &turn);
    let mut result = skill_assessment::presence(&work, &[("time_events", "direct")]);
    let mut answers: Value = serde_json::from_str(&result.text).unwrap();
    let temporal = answers
        .as_object_mut()
        .unwrap()
        .remove("time_events")
        .unwrap();
    answers["past_events"] = temporal;
    result.text = answers.to_string();
    store.finish(&work, Ok(result)).unwrap();
    assert!(observation(&store, &turn).is_null());
    let diagnostics: String = store
        .connection
        .query_row(
            "SELECT diagnostics FROM attempts WHERE id=?1",
            [&work.attempt],
            |r| r.get(0),
        )
        .unwrap();
    assert!(diagnostics.contains("coverage"));
}

#[test]
fn group_revision_credit_is_once_per_submission_and_survives_reopen() {
    let (dir, mut store, conversation) = setup();
    let first = prepare(&mut store, &conversation, "Ayer fui al mercado.");
    let work = skill_assessment::assessment(&mut store, &first);
    let response = skill_assessment::presence(&work, &[("time_events", "direct")]);
    publish_credit(&mut store, &first, &work, &response);
    complete_credit_fixture(&store, &first);
    let second = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "Ayer fui al mercado y mañana iré otra vez.",
        ))
        .unwrap()
        .entity_id;
    capture(&store, &second);
    let work = skill_assessment::assessment(&mut store, &second);
    let response = skill_assessment::presence(&work, &[("time_events", "direct")]);
    publish_credit(&mut store, &second, &work, &response);
    complete_credit_fixture(&store, &second);
    let saved = observation(&store, &second);
    assert_eq!(
        saved["credits"],
        json!([{"skillId":"time_events","experience":0,"effort":1,"xp":1}])
    );
    let third = store
        .execute(revision_command(
            &store,
            &conversation,
            &second,
            "Ayer fui al mercado y mañana iré otra vez.",
        ))
        .unwrap()
        .entity_id;
    capture(&store, &third);
    let work = skill_assessment::assessment(&mut store, &third);
    let response = skill_assessment::presence(&work, &[("time_events", "direct")]);
    publish_credit(&mut store, &third, &work, &response);
    complete_credit_fixture(&store, &third);
    assert_eq!(observation(&store, &third)["credits"], json!([]));
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(observation(&store, &second), saved);
}
