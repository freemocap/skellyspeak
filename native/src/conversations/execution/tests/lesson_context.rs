use super::*;

#[test]
fn audit_oversized_current_lesson_review_fails_only_its_operation() {
    let (_dir, mut store, conversation) = setup();
    let snapshot = store.snapshot().unwrap();
    let revision = snapshot.conversations[0].revision;
    let turn = accept_send(
        &store.connection,
        &store.config,
        &snapshot,
        &conversation,
        &"界".repeat(20000),
        revision,
    )
    .unwrap();
    store
        .connection
        .execute(
            "UPDATE turns SET context=json_set(context,'$.activeLesson',json(?2)) WHERE id=?1",
            params![
                turn,
                serde_json::json!({"handoffTurnId":turn,"plan":{}}).to_string()
            ],
        )
        .unwrap();
    store.connection.execute("INSERT INTO operations(id,turn_id,kind,state) VALUES('audit-review',?1,'lesson_review','waiting_dependencies')",[&turn]).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let dispatched = store.dispatch().unwrap().unwrap();
    store
        .finish(&dispatched, Ok(reply(&"界".repeat(12000))))
        .unwrap();
    for _ in 0..16 {
        store.dispatch().unwrap();
    }
    let (state, model, error): (String, String, String) = store.connection.query_row("SELECT o.state,a.requested_model,a.error FROM operations o JOIN attempts a ON a.operation_id=o.id WHERE o.id='audit-review'",[],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).unwrap();
    assert_eq!(state, "failed");
    assert_eq!(model, "local");
    assert!(error.contains("latest lesson exchange exceeds"));
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM messages WHERE turn_id=?1",
                [&turn],
                |r| r.get::<_, i32>(0)
            )
            .unwrap(),
        2
    );
    // Unrelated work still admits and dispatches through the same store.
    let contact = store.snapshot().unwrap().contacts[0].id.clone();
    let other = apply(
        &mut store,
        Action::CreateConversation {
            contact_id: contact,
            title: "Other".into(),
        },
    )
    .entity_id;
    store.execute(send(&store, &other)).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    assert!(store.dispatch().unwrap().is_some());
}

#[test]
fn audit_lesson_review_drops_old_exchanges_to_fit_serialized_budget() {
    let (_dir, mut store, conversation) = setup();
    let mut command = send(&store, &conversation);
    if let Action::SendMessage { text, .. } = &mut command.action {
        *text = "界".repeat(15000);
    }
    let first = store.execute(command).unwrap().entity_id;
    store.dispatch().unwrap();
    let dispatched = store.dispatch().unwrap().unwrap();
    store
        .finish(&dispatched, Ok(reply(&"界".repeat(10000))))
        .unwrap();
    let mut command = send(&store, &conversation);
    if let Action::SendMessage { text, .. } = &mut command.action {
        *text = "界".repeat(3000);
    }
    let current = store.execute(command).unwrap().entity_id;
    store.dispatch().unwrap();
    let dispatched = store.dispatch().unwrap().unwrap();
    store
        .finish(&dispatched, Ok(reply(&"界".repeat(4000))))
        .unwrap();
    let raw: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&current], |r| {
            r.get(0)
        })
        .unwrap();
    let mut captured: serde_json::Value = serde_json::from_str(&raw).unwrap();
    captured["activeLesson"] = serde_json::json!({"handoffTurnId":first,"plan":{}});
    let prompt =
        crate::learning::lessons::prompt(&store.connection, &current, "lesson_review", &captured)
            .unwrap();
    assert!(prompt.iter().map(|m| m.content.len()).sum::<usize>() <= 96000);
    let data: serde_json::Value = serde_json::from_str(&prompt[1].content).unwrap();
    let exchange = data["exchange"].as_array().unwrap();
    assert_eq!(exchange.len(), 2);
    assert!(exchange.iter().all(|m| m["turnId"] == current));
    assert_eq!(exchange[0]["text"], "界".repeat(3000));
    assert_eq!(exchange[1]["text"], "界".repeat(4000));
}
