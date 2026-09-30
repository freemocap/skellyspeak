use super::*;

fn message_id(store: &Store, turn: &str) -> String {
    store
        .connection
        .query_row(
            "SELECT id FROM messages WHERE turn_id=?1 AND role='user'",
            [turn],
            |r| r.get(0),
        )
        .unwrap()
}

#[test]
fn fixes_have_fresh_inputs_and_history_keeps_each_versions_own_feedback() {
    let (dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "Original response");
    wave2_observe(
        &store,
        &first,
        "coach_feedback",
        serde_json::json!({"meaning_recovered":"partial","items":[wave2_error("¿cómo estás?")]}),
    );
    let original_message = message_id(&store, &first);
    let revised = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "¿Cómo está tu hermana?",
        ))
        .unwrap()
        .entity_id;
    let revised_message = message_id(&store, &revised);
    let captured = wave2_context(&store, &revised);
    assert!(captured.get("coachRetry").is_none());
    assert!(captured.get("coachObservation").is_none());
    assert!(captured.get("coachDecision").is_none());
    let prompt =
        crate::learning::coaching::prompt(&store.connection, &revised, "coach_feedback", &captured)
            .unwrap();
    let request: serde_json::Value = serde_json::from_str(&prompt[1].content).unwrap();
    assert_eq!(request["learnerSource"], "¿Cómo está tu hermana?");
    assert!(request.get("coachRetry").is_none());
    assert!(request.get("privateCoachHistory").is_none());
    assert!(
        !prompt[1]
            .content
            .contains("Use está to ask how someone is.")
    );
    assert!(
        !request["priorConversation"]
            .to_string()
            .contains("Original response")
    );
    let pending = store
        .message_history(&conversation, &original_message)
        .unwrap();
    assert_eq!(pending.current_message_id, revised_message);
    assert_eq!(pending.versions.len(), 2);
    assert!(pending.versions[0].feedback.is_some());
    assert!(pending.versions[1].feedback.is_none());
    assert!(pending.versions[1].coach_decision.is_none());
    finish_fixture_exchange(&mut store, &revised, "Fresh response");
    wave2_observe(
        &store,
        &revised,
        "coach_feedback",
        serde_json::json!({"meaning_recovered":"full","items":[]}),
    );
    let history = store
        .message_history(&conversation, &revised_message)
        .unwrap();
    assert_eq!(history.root_message_id, original_message);
    assert_eq!(
        history.versions[1].previous_message_id.as_deref(),
        Some(original_message.as_str())
    );
    assert_eq!(
        history.versions[0].feedback.as_ref().unwrap().items.len(),
        1
    );
    assert!(
        history.versions[1]
            .feedback
            .as_ref()
            .unwrap()
            .items
            .is_empty()
    );
    let attempts: Vec<_> = history
        .versions
        .iter()
        .map(|v| {
            v.assessments
                .iter()
                .find(|a| a.kind == "coach_feedback")
                .unwrap()
                .attempt_id
                .clone()
        })
        .collect();
    assert_ne!(attempts[0], attempts[1]);
    assert!(
        store
            .message_history("another-conversation", &revised_message)
            .is_err()
    );
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        store
            .message_history(&conversation, &original_message)
            .unwrap()
            .versions
            .len(),
        2
    );
}

#[test]
fn version_history_is_not_limited_to_the_loaded_message_page() {
    let (_dir, mut store, conversation) = setup();
    let mut turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let original = message_id(&store, &turn);
    // Two messages per version exceed the snapshot's 100-message page.
    for index in 0..51 {
        finish_fixture_exchange(&mut store, &turn, "Response");
        turn = store
            .execute(revision_command(
                &store,
                &conversation,
                &turn,
                &format!("Version {index}"),
            ))
            .unwrap()
            .entity_id;
    }
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(!snapshot.messages.iter().any(|m| m.id == original));
    let history = store
        .message_history(&conversation, &message_id(&store, &turn))
        .unwrap();
    assert_eq!(history.versions.len(), 52);
    assert_eq!(history.root_message_id, original);
    assert_eq!(history.versions.last().unwrap().text, "Version 50");
}

#[test]
fn database_rejects_text_mutation_and_cross_version_assessment_ownership() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "Response");
    wave2_observe(
        &store,
        &first,
        "coach_feedback",
        serde_json::json!({"meaning_recovered":"full","items":[]}),
    );
    let original = message_id(&store, &first);
    let revised = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "Different source",
        ))
        .unwrap()
        .entity_id;
    let current = message_id(&store, &revised);
    let attempt: String = store
        .connection
        .query_row(
            "SELECT attempt_id FROM message_assessments WHERE message_id=?1",
            [&original],
            |r| r.get(0),
        )
        .unwrap();
    assert!(
        store
            .connection
            .execute(
                "UPDATE messages SET text='Changed' WHERE id=?1",
                [&original]
            )
            .is_err()
    );
    assert!(
        store
            .connection
            .execute(
                "UPDATE messages SET turn_id=?2 WHERE id=?1",
                params![original, revised]
            )
            .is_err()
    );
    assert!(
        store
            .connection
            .execute(
                "UPDATE message_assessments SET message_id=?2 WHERE attempt_id=?1",
                params![attempt, current]
            )
            .is_err()
    );
    // A new insert must also prove the attempt and message share an owner.
    store
        .connection
        .execute(
            "DELETE FROM message_assessments WHERE attempt_id=?1",
            [&attempt],
        )
        .unwrap();
    assert!(
        crate::conversations::assessments::publish(
            &store.connection,
            &revised,
            "coach_feedback",
            &attempt,
            &serde_json::json!({})
        )
        .is_err()
    );
    assert!(
        crate::conversations::assessments::publish(
            &store.connection,
            &first,
            "coach_feedback",
            &attempt,
            &serde_json::json!({})
        )
        .is_err(),
        "A replaced version cannot publish a new result either"
    );
    assert!(store.connection.execute(
        "UPDATE operations SET turn_id=?2 WHERE id=(SELECT operation_id FROM attempts WHERE id=?1)",
        params![attempt, revised],
    ).is_err());
    assert!(store.connection.execute(
        "UPDATE attempts SET operation_id=(SELECT id FROM operations WHERE turn_id=?2 AND kind='coach_feedback') WHERE id=?1",
        params![attempt, revised],
    ).is_err());
}

#[test]
fn late_old_assessment_cannot_publish_after_a_fix() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','coach_feedback')", []).unwrap();
    store.dispatch().unwrap();
    let partner = store.dispatch().unwrap().unwrap();
    let assessment = store.dispatch().unwrap().unwrap();
    store.finish(&partner, Ok(reply("Response"))).unwrap();
    let revised = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "Fresh wording",
        ))
        .unwrap()
        .entity_id;
    store.finish(&assessment, Ok(reply(&serde_json::json!({"meaning_recovered":"partial","items":[wave2_error("¿cómo estás?")]}).to_string()))).unwrap();
    let history = store
        .message_history(&conversation, &message_id(&store, &revised))
        .unwrap();
    assert!(history.versions.iter().all(|v| v.feedback.is_none()));
    assert_eq!(
        history.versions[0]
            .assessments
            .iter()
            .find(|a| a.kind == "coach_feedback")
            .unwrap()
            .state,
        "invalidated"
    );
    assert_eq!(
        store
            .connection
            .query_row("SELECT count(*) FROM message_assessments", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
}

#[test]
fn unchanged_correction_is_retryable_failure_not_a_learner_error() {
    let (_dir, mut store, conversation) = setup();
    store.execute(send(&store, &conversation)).unwrap();
    store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','coach_feedback')", []).unwrap();
    store.dispatch().unwrap();
    let partner = store.dispatch().unwrap().unwrap();
    let assessment = store.dispatch().unwrap().unwrap();
    let mut item = wave2_error("¿cómo estás?");
    item["error"]["target_hypothesis"] = item["quote"].clone();
    store
        .finish(
            &assessment,
            Ok(reply(
                &serde_json::json!({"meaning_recovered":"full","items":[item]}).to_string(),
            )),
        )
        .unwrap();
    store.finish(&partner, Ok(reply("Response"))).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    let message = snapshot.messages.iter().find(|m| m.role == "user").unwrap();
    assert!(message.feedback.is_none());
    assert!(message.coach_decision.is_none());
    assert_eq!(message.feedback_state.as_deref(), Some("failed"));
    assert!(
        message
            .feedback_error
            .as_ref()
            .unwrap()
            .contains("no usable assessment items")
    );
    let retained: String = store
        .connection
        .query_row(
            "SELECT response_text FROM attempts WHERE id=?1",
            [&assessment.attempt],
            |r| r.get(0),
        )
        .unwrap();
    assert!(retained.contains("target_hypothesis"));
    assert_eq!(
        store
            .connection
            .query_row("SELECT count(*) FROM message_assessments", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        0
    );
}
