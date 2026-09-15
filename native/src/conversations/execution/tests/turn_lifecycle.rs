use super::*;

#[test]
fn send_is_atomic_idempotent_and_only_one_pending_reply() {
    let (_dir, mut store, conversation) = setup();

    let command = send(&store, &conversation);
    let first = store.execute(command.clone()).unwrap();
    assert_eq!(store.execute(command).unwrap().entity_id, first.entity_id);
    let second = send(&store, &conversation);
    assert!(store.execute(second).is_err());
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 1);
    assert_eq!(snapshot.turns.len(), 1);
    assert_eq!(snapshot.turns[0].operations.len(), 8); // Suggestions are requested separately; read aloud is disabled in this fixture.
}

#[test]
fn gate_and_step_admit_one_operation_and_do_not_bank_extra_permits() {
    let (_dir, mut store, conversation) = setup();
    assert!(!store.has_ready_work().unwrap());
    apply(&mut store, Action::SetPaused { paused: true });
    let command = send(&store, &conversation);
    let turn = store.execute(command).unwrap().entity_id;
    isolate_coaching(&mut store);
    assert!(!store.has_ready_work().unwrap());
    assert!(store.dispatch().unwrap().is_none());
    assert!(control_turn(&store.connection, &turn, TurnControl::Step).is_err());
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn.clone(),
            control: TurnControl::Pause,
        },
    );
    apply(&mut store, Action::SetPaused { paused: false });
    assert!(!store.has_ready_work().unwrap());
    assert!(store.dispatch().unwrap().is_none());
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn.clone(),
            control: TurnControl::Step,
        },
    );
    assert!(store.dispatch().unwrap().is_none());
    assert!(store.dispatch().unwrap().is_none());
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.turns[0].attempts.len(), 1);
    assert_eq!(snapshot.turns[0].operations[1].state, "held");
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn.clone(),
            control: TurnControl::Step,
        },
    );
    let dispatch = store.dispatch().unwrap().unwrap();
    assert!(control_turn(&store.connection, &turn, TurnControl::Step).is_err());
    store
        .finish(&dispatch, Ok(reply("¡Hola! Estoy bien.")))
        .unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .len(),
        2
    );
}

#[test]
fn accepted_reply_survives_restart_and_duplicate_publication() {
    let (dir, mut store, conversation) = setup();
    let dispatch = begin(&mut store, &conversation);
    store.finish(&dispatch, Ok(reply("¡Hola!"))).unwrap();
    store.finish(&dispatch, Ok(reply("Duplicate"))).unwrap();
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 2);
    assert_eq!(snapshot.messages[1].text, "¡Hola!");
    assert_eq!(snapshot.turns[0].attempts[1].input_tokens, Some(21));
}

#[test]
fn restart_preserves_unknown_attempt_without_automatic_dispatch() {
    let (dir, mut store, conversation) = setup();
    begin(&mut store, &conversation);
    drop(store);
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.turns[0].state, "unknown");
    assert_eq!(snapshot.messages.len(), 1);
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: snapshot.turns[0].id.clone(),
            control: TurnControl::Retry,
        },
    );
    assert!(store.dispatch().unwrap().is_some());
}

#[test]
fn cancellation_and_deletion_revoke_late_publication() {
    let (_dir, mut store, conversation) = setup();
    let dispatch = begin(&mut store, &conversation);
    let turn = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .turns[0]
        .id
        .clone();
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn,
            control: TurnControl::Cancel,
        },
    );
    store.finish(&dispatch, Ok(reply("Too late"))).unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .len(),
        1
    );
    let dispatch = begin(&mut store, &conversation);
    let revision = store.snapshot().unwrap().conversations[0].revision;
    apply(
        &mut store,
        Action::DeleteConversation {
            conversation_id: conversation.clone(),
            expected_revision: revision,
        },
    );
    store
        .finish(&dispatch, Ok(reply("Cannot resurrect")))
        .unwrap();
    assert!(store.conversation_snapshot(&conversation, None).is_err());
    assert_eq!(
        store
            .connection
            .query_row("SELECT count(*) FROM attempts", [], |r| r.get::<_, i32>(0))
            .unwrap(),
        0
    );
}

#[test]
fn invalid_prose_keeps_usage_and_retry_does_not_duplicate_user_message() {
    let (_dir, mut store, conversation) = setup();
    let dispatch = begin(&mut store, &conversation);
    store.finish(&dispatch, Ok(reply("Hello 🌊"))).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 1);
    assert_eq!(snapshot.turns[0].state, "failed");
    assert_eq!(snapshot.turns[0].attempts[1].output_tokens, Some(8));
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: snapshot.turns[0].id.clone(),
            control: TurnControl::Retry,
        },
    );
    let retry = store.dispatch().unwrap().unwrap();
    assert_ne!(retry.attempt, dispatch.attempt);
    store.finish(&retry, Ok(reply("Hola"))).unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .len(),
        2
    );
}

#[test]
fn truncated_reply_is_not_published_but_usage_is_retained() {
    let (_dir, mut store, conversation) = setup();
    let dispatch = begin(&mut store, &conversation);
    let mut completion = reply("Incomplete sentence");
    completion.finish_reason = "length".into();
    store.finish(&dispatch, Ok(completion)).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 1);
    assert_eq!(snapshot.turns[0].state, "failed");
    assert_eq!(snapshot.turns[0].attempts[1].input_tokens, Some(21));
}

#[test]
fn captured_settings_and_persona_context_are_scoped_and_credential_revocation_wins() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    store.execute(command).unwrap();
    isolate_coaching(&mut store);
    let snapshot = store.snapshot().unwrap();
    let mut settings = snapshot.conversations[0].settings.clone();
    settings.difficulty = Difficulty::Advanced;
    apply(
        &mut store,
        Action::UpdateSettings {
            conversation_id: conversation.clone(),
            expected_revision: 1,
            settings,
        },
    );
    store.dispatch().unwrap();
    let dispatch = store.dispatch().unwrap().unwrap();
    assert!(
        dispatch.messages[0]
            .content
            .contains("Beginner difficulty:")
    );
    assert!(
        !dispatch.messages[0]
            .content
            .contains("Advanced difficulty:")
    );
    store
        .set_connection(
            2,
            None,
            "google/gemini-2.5-flash",
            "google/gemini-2.5-flash-lite",
        )
        .unwrap();
    store.finish(&dispatch, Ok(reply("Revoked"))).unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .len(),
        1
    );
}
