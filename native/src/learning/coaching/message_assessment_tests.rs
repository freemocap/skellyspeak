use super::*;
fn completion(text: String) -> Completion {
    Completion {
        text,
        finish_reason: "stop".into(),
        actual_model: "fixture".into(),
        provider_id: "fixture".into(),
        input_tokens: None,
        output_tokens: None,
        diagnostics: None,
    }
}
fn answer(kind: &str, choice: &str) -> Value {
    let q = questions(kind).unwrap();
    Value::Object(
        q.as_object()
            .unwrap()
            .iter()
            .map(|(key, q)| {
                let p: serde_json::Map<String, Value> = q["criteria"]
                    .as_object()
                    .unwrap()
                    .keys()
                    .map(|label| {
                        (
                            label.clone(),
                            json!(if label == choice { 1.0 } else { 0.0 }),
                        )
                    })
                    .collect();
                (
                    key.clone(),
                    json!({"type":"choice","choice":choice,"probabilities":p,"confidence":1.0}),
                )
            })
            .collect(),
    )
}
#[test]
fn validates_zero_abstention_and_complete_distributions() {
    for (choice, score) in [
        ("score_0", json!(0)),
        ("score_10", json!(10)),
        ("insufficient_evidence", Value::Null),
    ] {
        let out = validate(
            "conversation_feedback",
            &completion(answer("conversation_feedback", choice).to_string()),
        )
        .unwrap();
        assert_eq!(out["grammar"], score);
    }
    let mut bad = answer("conversation_feedback", "score_10");
    bad["grammar"]["probabilities"]["score_9"] = json!(0.5);
    assert!(validate("conversation_feedback", &completion(bad.to_string())).is_err());
    let mut bad = answer("conversation_feedback", "score_10");
    bad.as_object_mut().unwrap().remove("conversation");
    assert!(validate("conversation_feedback", &completion(bad.to_string())).is_err());
    assert!(
        validate(
            "conversation_feedback",
            &completion(json!({"grammar":5,"conversation":5}).to_string())
        )
        .is_err()
    );
    for label in questions("coach_reaction").unwrap()["understanding"]["criteria"]
        .as_object()
        .unwrap()
        .keys()
    {
        assert_eq!(
            validate(
                "coach_reaction",
                &completion(answer("coach_reaction", label).to_string())
            )
            .unwrap()["kind"],
            *label
        );
    }
}
#[test]
fn captured_variety_and_preceding_reply_are_used_without_future_leakage() {
    let db = Connection::open_in_memory().unwrap();
    db.execute_batch("CREATE TABLE messages(turn_id TEXT, role TEXT, text TEXT); INSERT INTO messages VALUES('t','user','source');").unwrap();
    let context = json!({"languageContext":{"target_name":"Arabic","variety_name":"Levantine"},"messages":[{"role":"system","content":"private"},{"role":"assistant","content":"prior"},{"role":"user","content":"source"}]});
    let prompt = prompt(&db, "t", "conversation_feedback", &context).unwrap();
    let r = request(&prompt, "conversation_feedback").unwrap();
    assert_eq!(r["state"]["variety"], "Levantine");
    assert_eq!(r["state"]["precedingPartner"], "prior");
    assert!(r["state"].get("actualPartnerReply").is_none());
    assert!(!r.to_string().contains("private"));
    assert!(super::prompt(&db, "t", "coach_reaction", &context).is_err());
}
