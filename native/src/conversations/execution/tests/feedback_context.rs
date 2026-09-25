use super::*;
fn cmd(store: &Store, action: Action) -> Command {
    Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action,
    }
}

#[test]
fn clarification_reassesses_only_feedback_and_survives_reopen() {
    let (dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.connection.execute("DELETE FROM operations WHERE kind NOT IN ('persona_context','persona_reply','coach_feedback')", []).unwrap();
    store.dispatch().unwrap();
    let partner = store.dispatch().unwrap().unwrap();
    let rating = store.dispatch().unwrap().unwrap();
    store.finish(&rating, Ok(reply(&serde_json::json!({"meaning_recovered":"partial","items":[wave2_error("¿cómo estás?")]}).to_string()))).unwrap();
    store
        .finish(&partner, Ok(reply("A relevant follow-up question?")))
        .unwrap();
    let note = "I meant to ask about yesterday; the transcript used present tense.";
    let command = cmd(
        &store,
        Action::ReassessFeedback {
            turn_id: turn.clone(),
            note: note.into(),
        },
    );
    store.execute(command.clone()).unwrap();
    store.execute(command).unwrap(); // Receipt replay must not queue a second assessment.
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages[0].feedback_context.as_deref(), Some(note));
    assert!(snapshot.messages[0].feedback.is_none());
    assert_eq!(snapshot.messages.len(), 2);
    let next = store.dispatch().unwrap().unwrap();
    let data: serde_json::Value = serde_json::from_str(&next.messages[1].content).unwrap();
    assert_eq!(data["learnerClarification"], note);
    assert_eq!(data["learnerSource"], snapshot.messages[0].text);
    assert!(
        store
            .execute(cmd(
                &store,
                Action::ReassessFeedback {
                    turn_id: turn.clone(),
                    note: "Another note".into()
                }
            ))
            .is_err()
    );
    store.finish(&rating, Ok(reply("{}"))).unwrap(); // Late old completion is ignored.
    assert!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages[0]
            .feedback
            .is_none()
    );
    store
        .finish(
            &next,
            Ok(reply(
                &serde_json::json!({"meaning_recovered":"full","items":[]}).to_string(),
            )),
        )
        .unwrap();
    assert!(store.dispatch().unwrap().is_none());
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        0
    );
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages[0].feedback_context.as_deref(), Some(note));
    assert!(
        snapshot.messages[0]
            .feedback
            .as_ref()
            .unwrap()
            .items
            .is_empty()
    );
}

#[test]
fn invalid_clarification_does_not_mutate_turn() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    for note in [" ".to_owned(), "x".repeat(2001), "bad\0note".to_owned()] {
        assert!(
            store
                .execute(cmd(
                    &store,
                    Action::ReassessFeedback {
                        turn_id: turn.clone(),
                        note
                    }
                ))
                .is_err()
        );
    }
    let saved: Option<String> = store
        .connection
        .query_row(
            "SELECT json_extract(context,'$.feedbackContext') FROM turns WHERE id=?1",
            [&turn],
            |r| r.get(0),
        )
        .unwrap();
    assert!(saved.is_none());
}
