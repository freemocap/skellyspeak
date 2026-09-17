use super::*;

fn start(store: &mut Store, conversation: &str) -> (String, Dispatch, Dispatch) {
    let turn = store.execute(send(store, conversation)).unwrap().entity_id;
    store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','skill_assessment')", []).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let persona = store.dispatch().unwrap().unwrap();
    let assessment = store.dispatch().unwrap().unwrap();
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT kind FROM operations WHERE id=?1",
                [&assessment.operation],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "skill_assessment"
    );
    (turn, persona, assessment)
}
fn judgment(quote: &str) -> Completion {
    reply(&serde_json::json!({"items":[{"construct":"question","quote":quote,"outcome":"demonstrated","rationale":"You ask how the other person is."}]}).to_string())
}
#[test]
fn independent_assessment_captures_all_criteria_and_awards_source_once() {
    let (_dir, mut store, conversation) = setup();
    let (_, persona, assessment) = start(&mut store, &conversation);
    let data: serde_json::Value = serde_json::from_str(&assessment.messages[1].content).unwrap();
    assert_eq!(data["criteria"].as_array().unwrap().len(), 45);
    assert!(
        assessment.messages[0]
            .content
            .contains("english, the learner's NATIVE language")
    );
    assert!(
        assessment.messages[0]
            .content
            .contains("cannot establish pronunciation")
    );
    store
        .finish(&assessment, Ok(judgment("¿cómo estás?")))
        .unwrap();
    let first = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert!(first["profile"]["xp"].as_u64().unwrap() > 0);
    store
        .finish(&assessment, Ok(judgment("¿cómo estás?")))
        .unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        first["profile"]["xp"]
    );
    store.finish(&persona, Ok(reply("Bien, gracias."))).unwrap();
    let (_, persona, assessment) = start(&mut store, &conversation);
    store
        .finish(&assessment, Ok(judgment("¿cómo estás?")))
        .unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        first["profile"]["xp"]
    );
    store.finish(&persona, Ok(reply("Bien."))).unwrap();
}
#[test]
fn invalid_evidence_fails_independently_and_next_voice_turn_can_start() {
    for bad in [
        r#"{"items":[{"construct":"question","quote":"partner invented this","outcome":"demonstrated","rationale":"No source"}]}"#,
        r#"{"items":[{"construct":"arabic.idafa","quote":"Hola","outcome":"demonstrated","rationale":"Excluded skill"}]}"#,
    ] {
        let (_dir, mut store, conversation) = setup();
        let (_, persona, assessment) = start(&mut store, &conversation);
        store.finish(&assessment, Ok(reply(bad))).unwrap();
        store.finish(&persona, Ok(reply("Bien."))).unwrap();
        assert_eq!(
            crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]
                ["xp"],
            0
        );
        assert!(store.execute(send(&store, &conversation)).is_ok());
    }
}

#[test]
fn repeated_skill_observations_are_validated_and_credit_is_not_multiplied() {
    let (_dir, mut store, conversation) = setup();
    let (turn, _, assessment) = start(&mut store, &conversation);
    let item = serde_json::json!({"construct":"question","quote":"¿cómo estás?","outcome":"demonstrated","rationale":"You ask a question."});
    let mut partial = item.clone();
    partial["outcome"] = serde_json::json!("partial");
    partial["rationale"] = serde_json::json!("The question is a partial attempt.");
    for entries in [
        vec![item.clone(), item.clone()],
        vec![item.clone(), partial.clone()],
        vec![partial.clone(), item.clone()],
    ] {
        let out = reply(&serde_json::json!({"items":entries}).to_string());
        let result =
            crate::learning::coaching::skill_assessment::validate(&store.connection, &turn, &out)
                .unwrap();
        assert_eq!(result["items"].as_array().unwrap().len(), 1);
        if entries.iter().any(|x| x["outcome"] == "partial") {
            assert_eq!(result["items"][0]["outcome"], "partial");
        }
    }
    let duplicate = reply(&serde_json::json!({"items":[item.clone(),item.clone()]}).to_string());
    store.finish(&assessment, Ok(duplicate)).unwrap();
    let before = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    store
        .finish(&assessment, Ok(judgment("¿cómo estás?")))
        .unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        before["profile"]["xp"]
    );
    for field in ["quote", "construct"] {
        let mut bad = item.clone();
        bad[field] = serde_json::json!("invalid sentinel");
        let out = reply(&serde_json::json!({"items":[item.clone(),bad]}).to_string());
        assert!(
            crate::learning::coaching::skill_assessment::validate(&store.connection, &turn, &out)
                .is_err()
        );
    }
}
