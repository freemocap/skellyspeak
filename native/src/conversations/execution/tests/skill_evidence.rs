use super::*;
use serde_json::json;

#[test]
fn failed_localization_retries_only_fast_node_and_publishes_jev_credit_once() {
    let (_dir, mut store, conversation) = setup();
    store.connection.execute("UPDATE ai_config SET assessment_adapter='jev_choice',fast_model='test/selected-fast'", []).unwrap();
    let turn = store.execute(send(&store, &conversation)).unwrap().entity_id;
    store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','skill_assessment','skill_evidence')", []).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let persona = store.dispatch().unwrap().unwrap();
    let assessment = store.dispatch().unwrap().unwrap();
    let answers: serde_json::Map<String, serde_json::Value> = assessment.decisions.as_ref().unwrap()["questions"].as_object().unwrap().keys().map(|id| {
        let yes = id == "question";
        (id.clone(), json!({"type":"choice","choice":if yes {"demonstrated"} else {"not_observed"},"confidence":1.0,"probabilities":{"demonstrated":if yes {1.0} else {0.0},"partial":0.0,"not_demonstrated":0.0,"not_observed":if yes {0.0} else {1.0},"uncertain":0.0}}))
    }).collect();
    let mut decisions = reply(&serde_json::to_string(&answers).unwrap());
    decisions.actual_model = crate::learning::coaching::assessment_adapter::MODEL.into();
    store.finish(&assessment, Ok(decisions)).unwrap();
    let before = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(before["profile"]["xp"], 0);
    assert_eq!(before["records"][0]["status"], "pending");
    let evidence = store.dispatch().unwrap().unwrap();
    assert_eq!(evidence.model, "test/selected-fast");
    assert!(evidence.decisions.is_none());
    assert_eq!(evidence.route, persona.route);
    assert_eq!(evidence.target.url, persona.target.url);
    let input: serde_json::Value = serde_json::from_str(&evidence.messages[1].content).unwrap();
    assert_eq!(input["criteria"].as_array().unwrap().len(), 1);
    assert_eq!(input["currentLearnerMessage"], "Hola, ¿cómo estás?");
    let mut invalid = reply(r#"{"items":[{"construct":"question","quote":"invented wording"}]}"#);
    invalid.diagnostics = Some(json!({"requestId":"span-request","usage":{"inputTokens":21}}));
    store.finish(&evidence, Ok(invalid)).unwrap();
    store.finish(&persona, Ok(reply("Bien."))).unwrap();
    let failed = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(failed["profile"]["xp"], 0);
    assert_eq!(failed["records"][0]["status"], "failed");
    let (state, tokens, diagnostics): (String, i32, String) = store.connection.query_row("SELECT state,input_tokens,diagnostics FROM attempts WHERE id=?1", [&evidence.attempt], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap();
    assert_eq!(state, "failed");
    assert_eq!(tokens, 21);
    assert!(diagnostics.contains("skill_evidence"));
    // Current Fast selection is captured by the existing explicit retry machinery.
    store.connection.execute("UPDATE ai_config SET fast_model='test/retry-fast'", []).unwrap();
    control_turn(&store.connection, &turn, TurnControl::Retry).unwrap();
    let retried = store.dispatch().unwrap().unwrap();
    assert_eq!(retried.operation, evidence.operation);
    assert_eq!(retried.model, "test/retry-fast");
    let output = reply(r#"{"items":[{"construct":"question","quote":"¿cómo estás?"}]}"#);
    store.finish(&retried, Ok(reply(&output.text))).unwrap();
    let done = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert!(done["profile"]["xp"].as_u64().unwrap() > 0);
    assert_eq!(done["records"][0]["attempt_id"], assessment.attempt);
    assert_eq!(done["records"][0]["assessment_adapter"], "jev_choice");
    let question = done["records"][0]["assessment"]["judgments"].as_array().unwrap().iter().find(|j| j["skill_id"] == "question").unwrap();
    assert_eq!(question["quotes"], json!(["¿cómo estás?"]));
    assert_eq!(question["evidence_kind"], "quoted");
    store.finish(&retried, Ok(output)).unwrap();
    assert_eq!(crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"], done["profile"]["xp"]);
    assert!(store.dispatch().unwrap().is_none());
}
