use super::*;

#[test]
#[ignore = "Lessons are disabled; retained lifecycle contract for a future re-enable"]
fn handoff_has_no_fake_user_and_never_repeats() {
    let (_dir, mut store, chat) = setup();
    let id = generate_ready(&mut store, &chat);
    control_lesson(&mut store, &chat, &id, LessonControl::Practice);
    assert!(has_exposure(&store.connection, &chat).unwrap());
    let root = owned(&store.connection, &chat, &id).unwrap();
    let handoff = root.handoff_turn_id.unwrap();
    let count: i32 = store
        .connection
        .query_row(
            "SELECT count(*) FROM messages WHERE turn_id=?1",
            [&handoff],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
    finish_handoff(&mut store);
    let rev = store.snapshot().unwrap().revision;
    let c = command(
        &store,
        Action::ControlLesson {
            conversation_id: chat.clone(),
            lesson_id: id.clone(),
            control: LessonControl::Practice,
            expected_revision: rev,
        },
    );
    assert!(store.execute(c).is_err());
    assert_eq!(
        store
            .conversation_snapshot(&chat, None)
            .unwrap()
            .messages
            .len(),
        1
    );
    control_lesson(&mut store, &chat, &id, LessonControl::End);
    assert!(!has_exposure(&store.connection, &chat).unwrap());
}

#[test]
#[ignore = "Lessons are disabled; retained lifecycle contract for a future re-enable"]
fn stale_cross_conversation_and_changed_difficulty_are_rejected() {
    let (_dir, mut store, chat) = setup();
    let id = generate_ready(&mut store, &chat);
    assert!(owned(&store.connection, "other", &id).is_err());
    let c = command(
        &store,
        Action::ControlLesson {
            conversation_id: chat.clone(),
            lesson_id: id.clone(),
            control: LessonControl::Open,
            expected_revision: 0,
        },
    );
    assert!(store.execute(c).is_err());
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.difficulty','advanced') WHERE conversation_id=?1",[&chat]).unwrap();
    let rev = store.snapshot().unwrap().revision;
    let c = command(
        &store,
        Action::ControlLesson {
            conversation_id: chat,
            lesson_id: id,
            control: LessonControl::Practice,
            expected_revision: rev,
        },
    );
    assert!(store.execute(c).is_err());
}

#[test]
#[ignore = "Lessons are disabled; retained lifecycle contract for a future re-enable"]
fn mid_chat_lesson_survives_history_revision_and_conversation_deletion_owns_everything() {
    let (_dir, mut store, chat) = setup();
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
            text: "Hola.".into(),
            input: crate::learning::coaching::InputEvidence::default(),
            expected_revision: revision,
        },
    )
    .entity_id;
    store.connection.execute("DELETE FROM operations WHERE turn_id=?1 AND kind NOT IN ('persona_context','persona_reply')",[&turn]).unwrap();
    store.dispatch().unwrap();
    let d = store.dispatch().unwrap().unwrap();
    store.finish(&d, Ok(completion("Hola.".into()))).unwrap();
    let lesson = generate_ready(&mut store, &chat);
    let choices = store
        .conversation_snapshot(&chat, None)
        .unwrap()
        .lesson_choices;
    assert_eq!(choices.len(), 3);
    let rev = store.snapshot().unwrap().revision;
    apply(
        &mut store,
        Action::ReviseTurn {
            conversation_id: chat.clone(),
            turn_id: turn,
            text: "Buenos días.".into(),
            input: crate::learning::coaching::InputEvidence::default(),
            expected_revision: rev,
        },
    );
    assert!(
        owned(&store.connection, &chat, &lesson)
            .unwrap()
            .plan
            .is_some()
    );
    let revision = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|c| c.id == chat)
        .unwrap()
        .revision;
    apply(
        &mut store,
        Action::DeleteConversation {
            conversation_id: chat.clone(),
            expected_revision: revision,
        },
    );
    assert!(views(&store.connection, &chat).unwrap().is_empty());
}

#[test]
#[ignore = "Lessons are disabled; retained lifecycle contract for a future re-enable"]
fn opening_exposure_is_consumed_once_without_claiming_all_future_chat_is_assisted() {
    let (_dir, mut store, chat) = setup();
    let id = generate_ready(&mut store, &chat);
    control_lesson(&mut store, &chat, &id, LessonControl::Open);
    assert!(has_exposure(&store.connection, &chat).unwrap());
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
            text: "¿A las dos?".into(),
            input: crate::learning::coaching::InputEvidence::default(),
            expected_revision: revision,
        },
    )
    .entity_id;
    assert!(!has_exposure(&store.connection, &chat).unwrap());
    let captured: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [&turn], |r| {
            r.get(0)
        })
        .unwrap();
    let captured: Value = serde_json::from_str(&captured).unwrap();
    assert_eq!(captured["lessonExposureIds"], json!([id]));
    assert_eq!(captured["input"]["scaffold"], true);
    assert!(owned(&store.connection, &chat, &id).unwrap().exposed);
}
