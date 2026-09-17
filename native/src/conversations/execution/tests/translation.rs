use super::*;

#[test]
fn r1_running_translation_survives_route_switch_but_not_revocation() {
    for revoke in [false, true] {
        let (_dir, mut store, conversation) = setup();
        let first = begin(&mut store, &conversation);
        store.finish(&first, Ok(reply("Hola."))).unwrap();
        let translation = store.dispatch().unwrap().unwrap();
        store.select_route(2, ConnectionRoute::Hosted).unwrap();
        assert!(store.attempt_active(&translation.attempt).unwrap());
        if revoke {
            store
                .set_connection(
                    3,
                    None,
                    "google/gemini-2.5-flash",
                    "google/gemini-2.5-flash-lite",
                )
                .unwrap();
        }
        store.finish(&translation, Ok(reply("Hello."))).unwrap();
        let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
        assert_eq!(snapshot.messages.len(), 2);
        assert_eq!(
            snapshot.messages[1].translation.as_deref(),
            if revoke { None } else { Some("Hello.") }
        );
        assert!(!store.attempt_active(&translation.attempt).unwrap());
        assert!(store.dispatch().unwrap().is_none());
    }
}

#[test]
fn r1_queue_reserves_translation_before_accepting_send() {
    let (_dir, mut store, first) = setup();

    let contact = store.snapshot().unwrap().contacts[0].id.clone();
    apply(&mut store, Action::SetPaused { paused: true });
    let mut last = first;
    for index in 0..=OUTSTANDING_NETWORK_LIMIT / 8 {
        if index > 0 {
            last = apply(
                &mut store,
                Action::CreateConversation {
                    contact_id: contact.clone(),
                    title: "Queue test".into(),
                },
            )
            .entity_id;
        }
        let command = send(&store, &last);
        if index == OUTSTANDING_NETWORK_LIMIT / 8 {
            let before = store.snapshot().unwrap().revision;
            assert_eq!(
                store.execute(command).unwrap_err().code,
                ErrorCode::AdmissionHeld
            );
            assert_eq!(store.snapshot().unwrap().revision, before);
            assert!(
                store
                    .conversation_snapshot(&last, None)
                    .unwrap()
                    .messages
                    .is_empty()
            );
        } else {
            store.execute(command).unwrap();
        }
    }
    let count: i64 = store.connection.query_row("SELECT count(*) FROM operations WHERE kind IN ('persona_reply','reply_translation','persona_word_gloss','conversation_feedback','reply_assistance','reply_explanations','user_word_gloss','user_translation')", [], |r| r.get(0)).unwrap();
    assert_eq!(count, OUTSTANDING_NETWORK_LIMIT / 8 * 8);
    assert_eq!(store.profile().unwrap().global.attempts, 0);
    assert!(store.dispatch().unwrap().is_none());
}

#[test]
fn r1_translation_captures_language_and_step_admits_one_attempt() {
    let (_dir, mut store, conversation) = setup();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.explanationLanguage','french','$.explanationVarietyId','french-france') WHERE conversation_id=?1", [&conversation]).unwrap();
    let first = begin(&mut store, &conversation);
    let turn = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .turns[0]
        .id
        .clone();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.translation',json('false'),'$.explanationLanguage','english','$.explanationVarietyId','english-united-states') WHERE conversation_id=?1", [&conversation]).unwrap();
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn.clone(),
            control: TurnControl::Pause,
        },
    );
    store.finish(&first, Ok(reply("Hola."))).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn.clone(),
            control: TurnControl::Step,
        },
    );
    let translation = store.dispatch().unwrap().unwrap();
    assert!(translation.messages[0].content.contains("into french."));
    assert!(control_turn(&store.connection, &turn, TurnControl::Step).is_err());
    assert!(store.dispatch().unwrap().is_none());
    store.finish(&translation, Ok(reply("Bonjour."))).unwrap();
    assert_eq!(store.profile().unwrap().global.attempts, 2);
    assert!(store.dispatch().unwrap().is_none());
}

#[test]
fn r1_route_switch_invalidates_undispatched_translation_only() {
    let (_dir, mut store, conversation) = setup();
    let dispatch = begin(&mut store, &conversation);
    store.select_route(2, ConnectionRoute::Hosted).unwrap();
    assert!(store.attempt_active(&dispatch.attempt).unwrap());
    store.finish(&dispatch, Ok(reply("Hola."))).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 2);
    assert_eq!(
        snapshot.messages[1].translation_state.as_deref(),
        Some("invalidated")
    );
    assert_eq!(snapshot.turns[0].state, "invalidated");
    assert_eq!(store.profile().unwrap().global.attempts, 1);
}

#[test]
fn r1_reply_completion_preserves_queued_translation_refusal() {
    let (_dir, mut store, conversation) = setup();
    let dispatch = begin(&mut store, &conversation);
    let turn = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .turns[0]
        .id
        .clone();
    let error = AppError::new(ErrorCode::Provider, "Rate limited")
        .with_refusal(crate::ai::policy::refusal::classify(None, None, None));
    store.note_refusal(&dispatch.target, &error).unwrap();
    store.finish(&dispatch, Ok(reply("Hola."))).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let hold = crate::ai::policy::holds::views(&store.connection)
        .unwrap()
        .remove(0);
    crate::ai::policy::holds::recover(&store.connection, &hold.id, &hold.generation).unwrap();
    assert!(control_turn(&store.connection, &turn, TurnControl::Step).is_err());
    assert!(store.dispatch().unwrap().is_none());
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn,
            control: TurnControl::Resume,
        },
    );
    let translation = store.dispatch().unwrap().unwrap();
    assert_eq!(translation.messages[1].content, "Hola.");
    store.finish(&translation, Ok(reply("Hello."))).unwrap();
    assert_eq!(store.profile().unwrap().global.attempts, 2);
}

#[test]
fn r1_translation_retry_after_later_reply_preserves_both_sources() {
    let (_dir, mut store, conversation) = setup();
    let first = begin(&mut store, &conversation);
    store.finish(&first, Ok(reply("Primero."))).unwrap();
    let translation = store.dispatch().unwrap().unwrap();
    store
        .finish(
            &translation,
            Err(AppError::new(ErrorCode::Provider, "Rejected")),
        )
        .unwrap();
    let turn = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .turns[0]
        .id
        .clone();
    let second = begin(&mut store, &conversation);
    store.finish(&second, Ok(reply("Segundo."))).unwrap();
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn.clone(),
            control: TurnControl::Retry,
        },
    );
    let retry = store.dispatch().unwrap().unwrap();
    assert_eq!(retry.operation, translation.operation);
    assert_eq!(retry.messages[1].content, "Primero.");
    store.finish(&retry, Ok(reply("First."))).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 4);
    assert_eq!(snapshot.messages[1].translation.as_deref(), Some("First."));
    assert_eq!(snapshot.messages[3].text, "Segundo.");
    let count: i64 = store.connection.query_row("SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.turn_id=?1 AND o.kind IN ('persona_reply','persona_opening')", [turn], |r| r.get(0)).unwrap();
    assert_eq!(count, 1);
}

#[test]
fn r1_translation_restart_before_and_after_dispatch_never_replays() {
    for dispatched in [false, true] {
        let (dir, mut store, conversation) = setup();
        let first = begin(&mut store, &conversation);
        store.finish(&first, Ok(reply("Hola."))).unwrap();
        let turn = store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .turns[0]
            .id
            .clone();
        if dispatched {
            store.dispatch().unwrap().unwrap();
        }
        drop(store);
        let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
        for _ in 0..3 {
            store.conversation_snapshot(&conversation, None).unwrap();
            assert!(store.dispatch().unwrap().is_none());
        }
        assert_eq!(
            store.profile().unwrap().global.attempts,
            if dispatched { 2 } else { 1 }
        );
        let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
        assert_eq!(
            snapshot.turns[0].state,
            if dispatched { "unknown" } else { "assisting" }
        );
        assert_eq!(snapshot.messages.len(), 2);
        apply(
            &mut store,
            Action::ControlTurn {
                turn_id: turn,
                control: if dispatched {
                    TurnControl::Retry
                } else {
                    TurnControl::Resume
                },
            },
        );
        let translation = store.dispatch().unwrap().unwrap();
        assert_eq!(translation.messages[1].content, "Hola.");
        store.finish(&translation, Ok(reply("Hello."))).unwrap();
        assert_eq!(
            store.profile().unwrap().global.attempts,
            if dispatched { 3 } else { 2 }
        );
        assert_eq!(
            store.profile().unwrap().global.unknown_usage,
            if dispatched { 1 } else { 0 }
        );
    }
}

#[test]
fn r1_retry_reserves_last_attempt_for_translation() {
    let (_dir, mut store, conversation) = setup();
    let first = begin(&mut store, &conversation);
    let turn = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .turns[0]
        .id
        .clone();
    store
        .finish(&first, Err(AppError::new(ErrorCode::Provider, "Rejected")))
        .unwrap();
    for attempt in 2..TURN_ATTEMPT_LIMIT {
        apply(
            &mut store,
            Action::ControlTurn {
                turn_id: turn.clone(),
                control: TurnControl::Retry,
            },
        );
        let next = store.dispatch().unwrap().unwrap();
        if attempt == TURN_ATTEMPT_LIMIT - 1 {
            store.finish(&next, Ok(reply("Hola."))).unwrap();
        } else {
            store
                .finish(&next, Err(AppError::new(ErrorCode::Provider, "Rejected")))
                .unwrap();
        }
    }
    let translation = store.dispatch().unwrap().unwrap();
    store
        .finish(
            &translation,
            Err(AppError::new(ErrorCode::Provider, "Rejected")),
        )
        .unwrap();
    let error = control_turn(&store.connection, &turn, TurnControl::Retry).unwrap_err();
    assert_eq!(error.code, ErrorCode::AdmissionHeld);
    assert_eq!(
        store.profile().unwrap().global.attempts,
        TURN_ATTEMPT_LIMIT as i32
    );
    assert!(store.dispatch().unwrap().is_none());
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
fn translation_is_source_linked_durable_and_does_not_block_next_reply() {
    let (dir, mut store, conversation) = setup();
    let dispatch = begin(&mut store, &conversation);
    store.finish(&dispatch, Ok(reply("Hola."))).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.turns[0].state, "assisting");
    assert_eq!(snapshot.messages[1].text, "Hola.");
    assert!(snapshot.messages[1].translation.is_none());
    let translation = store.dispatch().unwrap().unwrap();
    assert_eq!(translation.messages.len(), 2);
    assert_eq!(translation.messages[1].content, "Hola.");
    // A new learner message is accepted while translation is running.
    let next = send(&store, &conversation);
    store.execute(next).unwrap();
    store.finish(&translation, Ok(reply("Hello."))).unwrap();
    store.finish(&translation, Ok(reply("Duplicate"))).unwrap();
    let path = dir.path().join("test.sqlite3");
    drop(store);
    let store = Store::open(&path).unwrap();
    for _ in 0..5 {
        let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
        assert_eq!(snapshot.messages[1].translation.as_deref(), Some("Hello."));
        assert_eq!(snapshot.messages[1].text, "Hola.");
        assert_eq!(snapshot.messages.len(), 3);
    }
    assert_eq!(store.connection.query_row("SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.kind='reply_translation'", [], |r| r.get::<_,i32>(0)).unwrap(), 1);
}

#[test]
fn translation_failure_retries_only_assistance_and_cancellation_blocks_publication() {
    let (_dir, mut store, conversation) = setup();
    let dispatch = begin(&mut store, &conversation);
    store.finish(&dispatch, Ok(reply("Hola."))).unwrap();
    let translation = store.dispatch().unwrap().unwrap();
    store
        .finish(
            &translation,
            Err(AppError::new(ErrorCode::Provider, "Unavailable")),
        )
        .unwrap();
    assert!(!store.has_ready_work().unwrap());
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    let turn = snapshot.turns[0].id.clone();
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn.clone(),
            control: TurnControl::Retry,
        },
    );
    let retry = store.dispatch().unwrap().unwrap();
    assert_eq!(retry.operation, translation.operation);
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn,
            control: TurnControl::Cancel,
        },
    );
    store.finish(&retry, Ok(reply("Late translation"))).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 2);
    assert!(snapshot.messages[1].translation.is_none());
}

#[test]
fn sentence_translation_is_independent_of_token_display_preferences() {
    let (_dir, mut store, conversation) = setup();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.translation',json('false')) WHERE conversation_id=?1", [&conversation]).unwrap();
    let dispatch = begin(&mut store, &conversation);
    store.finish(&dispatch, Ok(reply("Hola."))).unwrap();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.translation',json('true')) WHERE conversation_id=?1", [&conversation]).unwrap();
    for _ in 0..10 {
        store.conversation_snapshot(&conversation, None).unwrap();
    }
    let translation = store.dispatch().unwrap().unwrap();
    assert!(translation.messages[0].content.contains("Translate"));
    store.finish(&translation, Ok(reply("Hello."))).unwrap();
    assert!(!store.has_ready_work().unwrap());
    assert!(store.dispatch().unwrap().is_none());
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .turns[0]
            .state,
        "succeeded"
    );
}

#[test]
fn translation_source_deletion_prevents_late_results() {
    let (_dir, mut store, conversation) = setup();
    let dispatch = begin(&mut store, &conversation);
    store.finish(&dispatch, Ok(reply("Hola."))).unwrap();
    let translation = store.dispatch().unwrap().unwrap();
    store
        .connection
        .execute("DELETE FROM conversations WHERE id=?1", [&conversation])
        .unwrap();
    store.finish(&translation, Ok(reply("Hello."))).unwrap();
    assert!(!store.attempt_active(&translation.attempt).unwrap());
}
