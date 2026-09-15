use super::*;

#[test]
fn generation_is_durable_structured_private_and_idempotent() {
    let (dir, mut store, chat) = setup();
    let rev = store.snapshot().unwrap().revision;
    let c = command(
        &store,
        Action::GenerateLesson {
            category: LessonCategory::Practical,
            choice_id: None,
            conversation_id: chat.clone(),
            topic: "Meeting times".into(),
            expected_revision: rev,
        },
    );
    let first = store.execute(c.clone()).unwrap();
    assert_eq!(store.execute(c).unwrap().entity_id, first.entity_id);
    store.dispatch().unwrap();
    let d = store.dispatch().unwrap().unwrap();
    assert!(d.messages[0].content.contains("2–4 minutes"));
    store
        .finish(&d, Ok(completion(plan().to_string())))
        .unwrap();
    let view = store.conversation_snapshot(&chat, None).unwrap();
    assert!(view.messages.is_empty());
    assert!(view.coach_messages.is_empty());
    assert_eq!(view.lessons[0].status, "ready");
    assert!(!view.lessons[0].exposed);
    assert!(!has_exposure(&store.connection, &chat).unwrap());
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        views(&store.connection, &chat).unwrap()[0]
            .plan
            .as_ref()
            .unwrap()
            .title,
        "Arrange a meeting"
    );
}

#[test]
fn invalid_generation_is_rejected_and_explicit_new_request_can_retry() {
    let (_dir, mut store, chat) = setup();
    let rev = store.snapshot().unwrap().revision;
    let id = apply(
        &mut store,
        Action::GenerateLesson {
            category: LessonCategory::Practical,
            choice_id: None,
            conversation_id: chat.clone(),
            topic: "Topic".into(),
            expected_revision: rev,
        },
    )
    .entity_id;
    store.dispatch().unwrap();
    let d = store.dispatch().unwrap().unwrap();
    let mut bad = plan();
    bad["examples"] = json!([]);
    store.finish(&d, Ok(completion(bad.to_string()))).unwrap();
    let lesson = owned(&store.connection, &chat, &id).unwrap();
    assert_eq!(lesson.status, "failed");
    assert!(lesson.error.is_some());
    assert!(lesson.plan.is_none());
    generate_ready(&mut store, &chat);
    assert_eq!(views(&store.connection, &chat).unwrap().len(), 2);
}

#[test]
fn categories_are_captured_in_the_saved_lesson_and_generation_prompt() {
    for category in [
        LessonCategory::Grammar,
        LessonCategory::AboutLanguage,
        LessonCategory::Reading,
    ] {
        let (_dir, mut store, chat) = setup();
        let revision = store.snapshot().unwrap().revision;
        let id = apply(
            &mut store,
            Action::GenerateLesson {
                category,
                choice_id: None,
                conversation_id: chat.clone(),
                topic: "Requested topic".into(),
                expected_revision: revision,
            },
        )
        .entity_id;
        assert_eq!(
            owned(&store.connection, &chat, &id).unwrap().category,
            category
        );
        let raw: String = store
            .connection
            .query_row("SELECT context FROM turns WHERE id=?1", [&id], |r| r.get(0))
            .unwrap();
        let messages = prompt(
            &store.connection,
            &id,
            "lesson_generate",
            &serde_json::from_str(&raw).unwrap(),
        )
        .unwrap();
        let data: Value = serde_json::from_str(&messages[1].content).unwrap();
        assert_eq!(data["category"], serde_json::to_value(category).unwrap());
        assert!(messages[0].content.contains("exactly two quiz questions"));
    }
}
