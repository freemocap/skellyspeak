use super::*;

#[test]
fn queue_budget_counts_chat_coach_and_paused_work_transactionally() {
    let (dir, mut store, first) = setup();
    let contact = store.snapshot().unwrap().contacts[0].id.clone();
    let retry_conversation = apply(
        &mut store,
        Action::CreateConversation {
            contact_id: contact.clone(),
            title: "Retry capacity".into(),
        },
    )
    .entity_id;
    let dispatch = begin(&mut store, &retry_conversation);
    store
        .finish(
            &dispatch,
            Err(AppError::new(ErrorCode::Provider, "Rejected")),
        )
        .unwrap();
    let retry_turn = store
        .conversation_snapshot(&retry_conversation, None)
        .unwrap()
        .turns[0]
        .id
        .clone();

    let mut first_turn = String::new();
    for index in 0..16 {
        let conversation = if index == 0 {
            first.clone()
        } else {
            apply(
                &mut store,
                Action::CreateConversation {
                    contact_id: contact.clone(),
                    title: format!("Queue {index}"),
                },
            )
            .entity_id
        };
        store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.translation',json('false')) WHERE conversation_id=?1", [&conversation]).unwrap();
        let mut command = send(&store, &conversation);
        if index % 2 != 0 {
            let Action::SendMessage {
                conversation_id,
                text,
                expected_revision,
                ..
            } = command.action
            else {
                unreachable!()
            };
            command.action = Action::AskCoach {
                conversation_id,
                text,
                expected_revision,
            };
        }
        let turn = store.execute(command).unwrap().entity_id;
        if index == 0 {
            first_turn = turn;
        }
    }
    // Fill with real multi-operation chat turns, then single-operation coach turns.
    // Hundreds of one-operation conversations obscure the admission assertions.
    let chat_cost: i64 = store
        .connection
        .query_row(
            "SELECT count(*) FROM operations WHERE turn_id=?1 AND kind != 'persona_context'",
            [&first_turn],
            |r| r.get(0),
        )
        .unwrap();
    loop {
        let outstanding: i64 = store.connection.query_row("SELECT count(*) FROM operations WHERE state IN ('ready','waiting_dependencies','running') AND kind NOT IN ('persona_context','coach_context')", [], |r| r.get(0)).unwrap();
        if outstanding >= OUTSTANDING_NETWORK_LIMIT {
            break;
        }
        let c = apply(
            &mut store,
            Action::CreateConversation {
                contact_id: contact.clone(),
                title: "Queue filler".into(),
            },
        )
        .entity_id;
        store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.readAloud',json('false'),'$.translation',json('false')) WHERE conversation_id=?1", [&c]).unwrap();
        let mut command = send(&store, &c);
        if OUTSTANDING_NETWORK_LIMIT - outstanding < chat_cost {
            let Action::SendMessage {
                conversation_id,
                expected_revision,
                ..
            } = command.action
            else {
                unreachable!()
            };
            command.action = Action::AskCoach {
                conversation_id,
                text: "Explain this word".into(),
                expected_revision,
            };
        }
        store.execute(command).unwrap();
    }
    let extra = apply(
        &mut store,
        Action::CreateConversation {
            contact_id: contact,
            title: "Extra".into(),
        },
    )
    .entity_id;
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.translation',json('false')) WHERE conversation_id=?1", [&extra]).unwrap();
    let path = dir.path().join("test.sqlite3");
    drop(store);
    let mut store = Store::open(&path).unwrap();
    let before = store.snapshot().unwrap().revision;
    let retry_error = store
        .execute(Command {
            session_id: store.session_id.clone(),
            action_id: id(),
            action: Action::ControlTurn {
                turn_id: retry_turn,
                control: TurnControl::Retry,
            },
        })
        .unwrap_err();
    assert_eq!(retry_error.code, ErrorCode::AdmissionHeld);
    assert_eq!(
        store
            .conversation_snapshot(&retry_conversation, None)
            .unwrap()
            .turns[0]
            .state,
        "failed"
    );
    let command = send(&store, &extra);
    assert_eq!(
        store.execute(command).unwrap_err().code,
        ErrorCode::AdmissionHeld
    );
    assert_eq!(store.snapshot().unwrap().revision, before);
    assert!(
        store
            .conversation_snapshot(&extra, None)
            .unwrap()
            .messages
            .is_empty()
    );
    let count: i64 = store
        .connection
        .query_row("SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id JOIN turns t ON t.id=o.turn_id WHERE t.state IN ('pending','assisting')", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 0);
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: first_turn,
            control: TurnControl::Cancel,
        },
    );
    let command = send(&store, &extra);
    store.execute(command).unwrap();
    isolate_coaching(&mut store);
}

#[test]
fn explicit_retries_survive_restart_without_lifetime_limit_and_preserve_receipts() {
    let (dir, mut store, conversation) = setup();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.translation',json('false')) WHERE conversation_id=?1", [&conversation]).unwrap();
    let first = begin(&mut store, &conversation);
    store
        .finish(
            &first,
            Err(AppError::new(ErrorCode::UnknownOutcome, "Unknown result")),
        )
        .unwrap();
    let turn = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .turns[0]
        .id
        .clone();
    for _ in 1..TURN_ATTEMPT_LIMIT + 2 {
        apply(
            &mut store,
            Action::ControlTurn {
                turn_id: turn.clone(),
                control: TurnControl::Retry,
            },
        );
        let dispatch = store.dispatch().unwrap().unwrap();
        store
            .finish(
                &dispatch,
                Err(AppError::new(ErrorCode::Provider, "Rejected")),
            )
            .unwrap();
    }
    drop(store);
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn.clone(),
            control: TurnControl::Retry,
        },
    );
    let retried = store.dispatch().unwrap().unwrap();
    store
        .finish(&retried, Err(fail("Still retryable")))
        .unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages.len(), 1);
    assert_eq!(
        snapshot.turns[0]
            .attempts
            .iter()
            .filter(|a| a.requested_model != "local")
            .count(),
        (TURN_ATTEMPT_LIMIT + 3) as usize
    );
    assert_eq!(snapshot.turns[0].state, "failed");
    assert!(store.dispatch().unwrap().is_none());
}

#[test]
fn background_work_uses_idle_capacity_and_queued_reply_gets_next_slot() {
    let (_dir, mut store, first) = setup();
    let contact_id = store.snapshot().unwrap().contacts[0].id.clone();
    // Leave several independent translations ready, without completing any.
    for index in 0..crate::ai::policy::admission::NETWORK_CAPACITY + 1 {
        let conversation = if index == 0 {
            first.clone()
        } else {
            apply(
                &mut store,
                Action::CreateConversation {
                    contact_id: contact_id.clone(),
                    title: format!("Parallel {index}"),
                },
            )
            .entity_id
        };
        let response = begin(&mut store, &conversation);
        store.finish(&response, Ok(reply("Hola"))).unwrap();
    }
    let mut active = Vec::new();
    for _ in 0..crate::ai::policy::admission::NETWORK_CAPACITY {
        assert!(store.has_ready_work().unwrap());
        let work = store
            .dispatch()
            .unwrap()
            .expect("idle capacity must be used");
        assert!(work.messages[0].content.contains("Translate"));
        active.push(work);
    }
    assert!(store.has_ready_work().unwrap());
    assert!(
        store.dispatch().unwrap().is_none(),
        "shared limit still applies"
    );
    let conversation = apply(
        &mut store,
        Action::CreateConversation {
            contact_id,
            title: "Foreground while busy".into(),
        },
    )
    .entity_id;
    store.execute(send(&store, &conversation)).unwrap();
    store.finish(&active[0], Ok(reply("Hello"))).unwrap();
    assert!(store.dispatch().unwrap().is_none()); // Local context preparation.
    let response = store
        .dispatch()
        .unwrap()
        .expect("reply gets the released slot");
    assert!(!response.messages[0].content.contains("Translate"));
    // Other translations remain in flight; no sibling-completion barrier.
    for work in active.iter().skip(1) {
        assert!(store.attempt_active(&work.attempt).unwrap());
    }
}
