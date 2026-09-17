use super::*;

#[test]
#[ignore = "Lessons are disabled; retained lifecycle contract for a future re-enable"]
fn recap_needs_real_learner_evidence_and_ended_practice_cannot_complete() {
    let (_dir, mut store, chat) = setup();
    let id = generate_ready(&mut store, &chat);
    control_lesson(&mut store, &chat, &id, LessonControl::Practice);
    finish_handoff(&mut store);
    let revision = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|c| c.id == chat)
        .unwrap()
        .revision;
    let turn = apply(
        &mut store,
        Action::SendMessage {
            conversation_id: chat.clone(),
            text: "Sí, a las dos.".into(),
            input: crate::learning::coaching::InputEvidence::default(),
            expected_revision: revision,
        },
    )
    .entity_id;
    let context: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
            r.get(0)
        })
        .unwrap();
    let captured: Value = serde_json::from_str(&context).unwrap();
    assert_eq!(captured["input"]["scaffold"], true);
    let partner = captured["messages"][0]["content"].as_str().unwrap();
    assert!(!partner.contains("Explain the wording without grading"));
    let message: String = store
        .connection
        .query_row("SELECT id FROM messages WHERE turn_id=?1", [&turn], |r| {
            r.get(0)
        })
        .unwrap();
    let good = json!({"completed":true,"text":"You agreed on two o'clock.","evidence":[{"messageId":message,"quote":"a las dos"}]});
    assert!(
        validate(
            &store.connection,
            &turn,
            "lesson_review",
            &completion(good.to_string())
        )
        .is_ok()
    );
    let mut bad = good.clone();
    bad["evidence"][0]["quote"] = json!("invented");
    assert!(
        validate(
            &store.connection,
            &turn,
            "lesson_review",
            &completion(bad.to_string())
        )
        .is_err()
    );
    control_lesson(&mut store, &chat, &id, LessonControl::End);
    publish(&store.connection, &turn, "lesson_review", &good).unwrap();
    assert!(
        owned(&store.connection, &chat, &id)
            .unwrap()
            .recap
            .is_none()
    );
}

#[test]
#[ignore = "Lessons are disabled; retained lifecycle contract for a future re-enable"]
fn review_dispatch_completes_once_and_revision_removes_the_recap() {
    let (_dir, mut store, chat) = setup();
    let id = generate_ready(&mut store, &chat);
    control_lesson(&mut store, &chat, &id, LessonControl::Practice);
    finish_handoff(&mut store);
    let revision = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|c| c.id == chat)
        .unwrap()
        .revision;
    let turn = apply(
        &mut store,
        Action::SendMessage {
            conversation_id: chat.clone(),
            text: "Sí, a las dos.".into(),
            input: crate::learning::coaching::InputEvidence::default(),
            expected_revision: revision,
        },
    )
    .entity_id;
    store.connection.execute("DELETE FROM operations WHERE turn_id=?1 AND kind NOT IN ('persona_context','persona_reply','lesson_review')",[&turn]).unwrap();
    store.dispatch().unwrap();
    let reply = store.dispatch().unwrap().unwrap();
    store
        .finish(&reply, Ok(completion("De acuerdo, a las dos.".into())))
        .unwrap();
    let review = store.dispatch().unwrap().unwrap();
    assert!(review.messages[0].content.contains("Privately review"));
    let message: String = store
        .connection
        .query_row(
            "SELECT id FROM messages WHERE turn_id=?1 AND role='user'",
            [&turn],
            |r| r.get(0),
        )
        .unwrap();
    let output = json!({"completed":true,"text":"You agreed on two o'clock.","evidence":[{"messageId":message,"quote":"a las dos"}]});
    store
        .finish(&review, Ok(completion(output.to_string())))
        .unwrap();
    store
        .finish(&review, Ok(completion(output.to_string())))
        .unwrap();
    assert_eq!(
        owned(&store.connection, &chat, &id).unwrap().status,
        "completed"
    );
    assert_eq!(
        store
            .conversation_snapshot(&chat, None)
            .unwrap()
            .messages
            .len(),
        3
    );
    let rev = store.snapshot().unwrap().revision;
    apply(
        &mut store,
        Action::ReviseTurn {
            conversation_id: chat.clone(),
            turn_id: turn,
            text: "Mejor a las tres.".into(),
            input: crate::learning::coaching::InputEvidence::default(),
            expected_revision: rev,
        },
    );
    let lesson = owned(&store.connection, &chat, &id).unwrap();
    assert!(lesson.recap.is_none());
    assert_eq!(lesson.status, "ended");
}
