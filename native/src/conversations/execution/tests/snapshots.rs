use super::*;

#[test]
fn audit_unchanged_watch_checks_revision_without_hydrating() {
    let (_dir, store, conversation) = setup();
    let revision = store.snapshot().unwrap().revision;
    // A hydration failure acts as a probe: unchanged polling must not touch
    // the heavyweight conversation projection, even if it would fail.
    store
        .connection
        .execute(
            "UPDATE conversation_settings SET settings='{}' WHERE conversation_id=?1",
            [&conversation],
        )
        .unwrap();
    assert!(
        store
            .conversation_snapshot_since(&conversation, None, revision, false)
            .unwrap()
            .is_none()
    );
    assert!(
        store
            .conversation_snapshot_since(&conversation, None, revision, true)
            .is_err()
    );
    assert!(
        store
            .conversation_snapshot_since(&conversation, None, revision - 1, false)
            .is_err()
    );
}

#[test]
fn audit_older_message_page_contains_its_failed_turn_state() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.dispatch().unwrap();
    let dispatched = store.dispatch().unwrap().unwrap();
    store
        .finish(&dispatched, Err(fail("Fixture rejected reply")))
        .unwrap();
    let context: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&first], |r| {
            r.get(0)
        })
        .unwrap();
    for index in 2..=130 {
        let turn = format!("later-{index}");
        store.connection.execute("INSERT INTO turns(id,conversation_id,state,paused,profile_revision,credential_id,route,model,context) VALUES(?1,?2,'succeeded',0,1,'fixture','openrouter','fixture',?3)",params![turn,conversation,context]).unwrap();
        store.connection.execute("INSERT INTO operations(id,turn_id,kind,state) SELECT ?1||kind,?2,kind,CASE WHEN kind IN ('persona_context','persona_reply') THEN 'succeeded' ELSE 'cancelled' END FROM operations WHERE turn_id=?3",params![format!("operation-{index}-"),turn,first]).unwrap();
        store.connection.execute("INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text) VALUES(?1,?2,?3,?4,'assistant','Later reply')",params![format!("message-{index}"),conversation,turn,index]).unwrap();
    }
    let page = store
        .conversation_snapshot(&conversation, Some(31))
        .unwrap();
    assert!(page.messages.iter().any(|m| m.turn_id == first));
    let turn = page.turns.iter().find(|t| t.id == first).unwrap();
    assert!(
        turn.operations
            .iter()
            .any(|o| o.kind == "persona_reply" && o.state == "failed")
    );
    assert!(
        turn.attempts
            .iter()
            .any(|a| a.error.as_deref() == Some("Fixture rejected reply"))
    );
    assert!(page.turns.len() <= 150);
}

#[test]
fn levantine_has_all_topics() {
    let (_dir, mut store, _) = setup();
    let conversation = apply(
        &mut store,
        Action::StartChat {
            language_id: "arabic".into(),
        },
    )
    .entity_id;
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(view.topic_choices.len(), store.config.topics().len());
    let snapshot = store.snapshot().unwrap();
    assert_eq!(
        snapshot
            .conversations
            .iter()
            .find(|c| c.id == conversation)
            .unwrap()
            .settings
            .variety_id,
        "arabic-levantine"
    );
}

#[test]
fn conversations_have_separate_snapshots_and_app_concurrency_is_bounded() {
    let (_dir, mut store, first) = setup();
    let contact = store.snapshot().unwrap().contacts[0].id.clone();
    let second = apply(
        &mut store,
        Action::CreateConversation {
            contact_id: contact.clone(),
            title: "Second".into(),
        },
    )
    .entity_id;
    let third = apply(
        &mut store,
        Action::CreateConversation {
            contact_id: contact,
            title: "Third".into(),
        },
    )
    .entity_id;
    let a = begin(&mut store, &first);
    let b = begin(&mut store, &second);
    let mut extra = Vec::new();
    for index in 2..crate::ai::policy::admission::NETWORK_CAPACITY {
        let contact_id = store.snapshot().unwrap().contacts[0].id.clone();
        let conversation = apply(
            &mut store,
            Action::CreateConversation {
                contact_id,
                title: format!("Extra {index}"),
            },
        )
        .entity_id;
        extra.push(begin(&mut store, &conversation));
    }
    assert!(!store.has_ready_work().unwrap());
    let command = send(&store, &third);
    store.execute(command).unwrap();
    isolate_coaching(&mut store);
    assert!(store.has_ready_work().unwrap());
    assert!(store.dispatch().unwrap().is_none());
    store.finish(&b, Ok(reply("Second reply"))).unwrap();
    store.finish(&a, Ok(reply("First reply"))).unwrap();
    assert_eq!(
        store.conversation_snapshot(&first, None).unwrap().messages[1].text,
        "First reply"
    );
    assert_eq!(
        store.conversation_snapshot(&second, None).unwrap().messages[1].text,
        "Second reply"
    );
    assert!(store.dispatch().unwrap().is_none()); // Prepare the next foreground turn.
    let next_reply = store.dispatch().unwrap().unwrap();
    assert!(!next_reply.messages[0].content.contains("Translate"));
    let translation = store.dispatch().unwrap().unwrap();
    assert!(translation.messages[0].content.contains("Translate"));
    assert!(store.dispatch().unwrap().is_none());
}

#[test]
fn turn_history_pages_every_turn_independent_of_messages() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.dispatch().unwrap();
    let dispatched = store.dispatch().unwrap().unwrap();
    store
        .finish(&dispatched, Err(fail("Fixture rejected reply")))
        .unwrap();
    let context: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&first], |r| {
            r.get(0)
        })
        .unwrap();
    // Odd turns never produce a message, so message paging cannot reach them.
    for index in 2..=130 {
        let turn = format!("later-{index}");
        store.connection.execute("INSERT INTO turns(id,conversation_id,state,paused,profile_revision,credential_id,route,model,context) VALUES(?1,?2,'succeeded',0,1,'fixture','openrouter','fixture',?3)",params![turn,conversation,context]).unwrap();
        store.connection.execute("INSERT INTO operations(id,turn_id,kind,state) SELECT ?1||kind,?2,kind,CASE WHEN kind IN ('persona_context','persona_reply') THEN 'succeeded' ELSE 'cancelled' END FROM operations WHERE turn_id=?3",params![format!("operation-{index}-"),turn,first]).unwrap();
        if index % 2 == 0 {
            store.connection.execute("INSERT INTO messages(id,conversation_id,turn_id,sequence,role,text) VALUES(?1,?2,?3,?4,'assistant','Later reply')",params![format!("message-{index}"),conversation,turn,index]).unwrap();
        }
    }
    let mut seen = Vec::new();
    let mut before: Option<String> = None;
    loop {
        let page = store
            .turn_history(&conversation, before.as_deref(), 40)
            .unwrap();
        assert!(page.turns.len() <= 40);
        seen.extend(page.turns.iter().map(|turn| turn.id.clone()));
        if !page.has_older {
            break;
        }
        before = page.turns.last().map(|turn| turn.id.clone());
    }
    assert_eq!(seen.len(), 130);
    assert_eq!(seen.first().map(String::as_str), Some("later-130"));
    assert_eq!(seen.last(), Some(&first));
    assert!(seen.iter().any(|id| id == "later-3"));
    // History and the snapshot describe a turn through the same builder.
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    let recent = store.turn_history(&conversation, None, 10).unwrap();
    for turn in &recent.turns {
        let same = snapshot.turns.iter().find(|t| t.id == turn.id).unwrap();
        assert_eq!(
            serde_json::to_value(same).unwrap(),
            serde_json::to_value(turn).unwrap()
        );
    }
    let failed = store
        .turn_history(&conversation, Some("later-2"), 5)
        .unwrap();
    assert_eq!(failed.turns[0].id, first);
    assert!(!failed.has_older);
    assert!(
        store
            .turn_history(&conversation, Some("missing-turn"), 5)
            .is_err()
    );
}
