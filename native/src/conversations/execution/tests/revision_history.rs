use super::*;

#[test]
fn latest_revision_survives_background_updates_but_not_a_replacement() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "First reply.");
    let edit = revision_command(&store, &conversation, &first, "Updated wording");
    let obsolete = revision_command(&store, &conversation, &first, "Obsolete wording");
    bump(&store.connection).unwrap();
    let replacement = store.execute(edit).unwrap().entity_id;
    let captured = wave2_context(&store, &replacement);
    assert_eq!(
        captured["messages"].as_array().unwrap().last().unwrap()["content"],
        "Updated wording"
    );
    assert!(
        !captured["messages"]
            .as_array()
            .unwrap()
            .iter()
            .any(|m| m["content"] == "First reply.")
    );
    finish_fixture_exchange(&mut store, &replacement, "New reply.");
    assert_eq!(
        store.execute(obsolete).unwrap_err().code,
        ErrorCode::Conflict
    );
}

#[test]
fn revisions_regenerate_preserve_chain_credit_and_restart() {
    let (dir, mut store, conversation) = setup();
    let original = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &original, "Old response.");
    fixture_evidence(&store, &original, "¿cómo estás?");
    let command = revision_command(&store, &conversation, &original, "¿Cómo está tu hermana?");
    let revised = store.execute(command.clone()).unwrap().entity_id;
    assert_eq!(store.execute(command).unwrap().entity_id, revised);
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(view.messages.len(), 3);
    assert_eq!(view.messages[0].turn_id, original);
    assert_eq!(
        view.messages[0].replaced_by.as_deref(),
        Some(revised.as_str())
    );
    assert_eq!(
        view.messages[2].replaces_turn_id.as_deref(),
        Some(original.as_str())
    );
    assert!(store.dispatch().unwrap().is_none());
    let persona = store.dispatch().unwrap().unwrap();
    assert!(
        !persona
            .messages
            .iter()
            .any(|m| m.content == "Old response.")
    );
    store.finish(&persona, Ok(reply("Está bien."))).unwrap();
    fixture_evidence(&store, &revised, "¿Cómo está tu hermana?");
    let xp = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(xp["profile"]["xp"], 35);
    let record = xp["records"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["source"] == "¿Cómo está tu hermana?")
        .unwrap();
    assert_eq!(record["input"]["revision"], true);
    assert_eq!(record["replaces_message_id"], 1);
    let second = store
        .execute(revision_command(
            &store,
            &conversation,
            &revised,
            "¿Cómo está tu hermana?",
        ))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &second, "Bien.");
    fixture_evidence(&store, &second, "¿Cómo está tu hermana?");
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        35,
        "Repeated wording earns nothing further"
    );
    let record = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    let ids: Vec<_> = record["profile"]["credits"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|r| r["xp"] == 2)
        .map(|r| r["attempt_id"].clone())
        .collect();
    store
        .connection
        .execute(
            "INSERT INTO skill_choices VALUES('spanish',1,NULL,?1)",
            [serde_json::to_string(&ids).unwrap()],
        )
        .unwrap();
    // Exclude both repeated assisted observations, since either otherwise owns the wording.
    store
        .connection
        .execute(
            "UPDATE skill_choices SET excluded=?1",
            [
                serde_json::json!([format!("evidence-{second}"), format!("evidence-{revised}")])
                    .to_string(),
            ],
        )
        .unwrap();
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        30
    );
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(view.messages.len(), 6);
    assert_eq!(
        view.messages.last().unwrap().replaces_turn_id.as_deref(),
        Some(revised.as_str())
    );
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        30
    );
}

#[test]
fn earlier_revision_removes_exact_suffix_despite_background_changes_and_rejects_wrong_targets() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "First reply.");
    let stale = revision_command(&store, &conversation, &first, "Change");
    let later = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &later, "Later reply.");
    bump(&store.connection).unwrap();
    let rev = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .revision;
    let coach = apply(
        &mut store,
        Action::AskCoach {
            conversation_id: conversation.clone(),
            text: "Explain this".into(),
            expected_revision: rev,
        },
    )
    .entity_id;
    finish_fixture_exchange(&mut store, &coach, "Private answer.");
    assert_eq!(
        store
            .execute(revision_command(&store, &conversation, &coach, "Change"))
            .unwrap_err()
            .code,
        ErrorCode::Conflict
    );
    fixture_evidence(&store, &later, "¿cómo estás?");
    store
        .connection
        .execute(
            "INSERT INTO skill_choices VALUES('spanish',1,NULL,?1)",
            [serde_json::json!([format!("evidence-{later}")]).to_string()],
        )
        .unwrap();
    let counts = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .revision_suffix_counts;
    let counts = counts.iter().find(|c| c.turn_id == first).unwrap();
    assert_eq!((counts.exchange_count, counts.coach_turn_count), (1, 0));
    let contact = store.snapshot().unwrap().contacts[0].id.clone();
    let other = apply(
        &mut store,
        Action::CreateConversation {
            contact_id: contact,
            title: "Other".into(),
        },
    )
    .entity_id;
    assert_eq!(
        store
            .execute(revision_command(&store, &other, &first, "Change"))
            .unwrap_err()
            .code,
        ErrorCode::Conflict
    );
    let before = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(
        store
            .execute(revision_command(&store, &conversation, &first, ""))
            .unwrap_err()
            .code,
        ErrorCode::Validation
    );
    let after = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(after.revision, before.revision);
    assert_eq!(after.messages.len(), before.messages.len());
    assert_eq!(after.coach_messages.len(), before.coach_messages.len());
    let new = store.execute(stale).unwrap().entity_id;
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(view.messages.len(), 3);
    assert_eq!(view.coach_messages.len(), before.coach_messages.len());
    assert!(view.coach_messages.iter().any(|m| m.text == "Private answer."));
    let edits = crate::conversations::revision::coach_edits(&store.connection, &conversation).unwrap();
    assert_eq!(edits[0]["after"], "Change");
    assert_eq!(edits[0]["replacesTurnId"], first);
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["choices"]
            ["excluded_attempts"],
        serde_json::json!([])
    );

    for removed in [later] {
        assert_eq!(
            store
                .connection
                .query_row(
                    "SELECT count(*) FROM receipts WHERE json_extract(receipt,'$.entityId')=?1",
                    [&removed],
                    |r| r.get::<_, i32>(0)
                )
                .unwrap(),
            0
        );

        assert!(!view.turns.iter().any(|t| t.id == removed));
    }
    assert_eq!(
        store
            .execute(revision_command(&store, &conversation, &first, "Branch"))
            .unwrap_err()
            .code,
        ErrorCode::Conflict
    );
    assert!(view.turns.iter().any(|t| t.id == new));
    assert!(
        store
            .snapshot()
            .unwrap()
            .conversations
            .iter()
            .any(|c| c.id == other)
    );
}

#[test]
fn revised_sources_cannot_publish_late_analysis_or_reenter_future_context() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    store.finish(&persona, Ok(reply("Old response."))).unwrap();
    let feedback = store.dispatch().unwrap().unwrap();
    let revision = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "Repaired wording",
        ))
        .unwrap()
        .entity_id;
    store
        .finish(
            &feedback,
            Ok(reply(r#"{"remark":"Clear greeting.","usedTarget":[],"usedNative":[],"corrections":[],"grammar":5,"conversation":5}"#)),
        )
        .unwrap();
    assert!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages[0]
            .conversation_feedback
            .is_none()
    );
    let records = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert!(
        records["records"]
            .as_array()
            .unwrap()
            .iter()
            .all(|r| r["assessment"].is_null())
    );
    let status: String = store
        .connection
        .query_row(
            "SELECT state FROM operations WHERE id=?1",
            [&feedback.operation],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(status, "invalidated");
    finish_fixture_exchange(&mut store, &revision, "Current response.");
    let next = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let captured: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [next], |r| {
            r.get(0)
        })
        .unwrap();
    assert!(!captured.contains("Old response."));
    assert!(captured.contains("Current response."));
}

#[test]
fn retained_versions_are_available_beyond_message_and_operation_pages() {
    let (_dir, mut store, conversation) = setup();
    let first = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &first, "First reply.");
    let second = store
        .execute(revision_command(
            &store,
            &conversation,
            &first,
            "Second version",
        ))
        .unwrap()
        .entity_id;
    finish_fixture_exchange(&mut store, &second, "Second reply.");
    for _ in 0..51 {
        let turn = store
            .execute(send(&store, &conversation))
            .unwrap()
            .entity_id;
        finish_fixture_exchange(&mut store, &turn, "More.");
    }
    let latest = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(latest.messages.len(), 100);
    assert!(latest.has_older);
    let earlier = store
        .conversation_snapshot(&conversation, Some(latest.messages[0].sequence))
        .unwrap();
    assert!(!earlier.has_older);
    assert_eq!(earlier.messages[0].turn_id, first);
    assert_eq!(
        earlier.messages[0].replaced_by.as_deref(),
        Some(second.as_str())
    );
    assert_eq!(
        earlier.messages[2].replaces_turn_id.as_deref(),
        Some(first.as_str())
    );
}

#[test]
fn revision_replaces_running_reply_and_rejects_its_late_publication() {
    let (_dir, mut store, conversation) = setup();
    let original = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.dispatch().unwrap();
    let running = store.dispatch().unwrap().unwrap();
    let revised = store
        .execute(revision_command(
            &store,
            &conversation,
            &original,
            "Replacement speech",
        ))
        .unwrap()
        .entity_id;
    store
        .finish(&running, Ok(reply("Obsolete response")))
        .unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(!view.messages.iter().any(|m| m.text == "Obsolete response"));
    assert!(
        view.messages
            .iter()
            .any(|m| m.turn_id == revised && m.text == "Replacement speech")
    );
}

#[test]
fn coach_sees_retained_dialogue_and_before_after_edit_history() {
    let (_dir, mut store, conversation) = setup();
    let first = store.execute(send(&store, &conversation)).unwrap().entity_id;
    finish_fixture_exchange(&mut store, &first, "Original reply.");
    let ask = |store: &mut Store, text: &str| {
        let revision = store.snapshot().unwrap().conversations.iter().find(|c| c.id == conversation).unwrap().revision;
        apply(store, Action::AskCoach { conversation_id:conversation.clone(), text:text.into(), expected_revision:revision }).entity_id
    };
    let coach = ask(&mut store, "Explain my wording");
    finish_fixture_exchange(&mut store, &coach, "Private guidance.");
    let original: String = store.connection.query_row("SELECT text FROM messages WHERE turn_id=?1 AND role='user'", [&first], |r|r.get(0)).unwrap();
    let revised = store.execute(revision_command(&store,&conversation,&first,"Revised wording")).unwrap().entity_id;
    finish_fixture_exchange(&mut store,&revised,"Updated reply.");
    let next = ask(&mut store,"What changed?");
    let context = wave2_context(&store,&next);
    let system = context["messages"][0]["content"].as_str().unwrap();
    assert!(system.contains("messageEdits"));
    assert!(system.contains(&original));
    assert!(system.contains("Revised wording"));
    assert!(context["messages"].as_array().unwrap().iter().any(|m|m["content"]=="Private guidance."));
}
