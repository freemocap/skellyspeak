use super::*;

#[test]
#[ignore = "Lessons are disabled; retained lifecycle contract for a future re-enable"]
fn selected_choice_is_validated_and_its_constructs_reach_the_generation_prompt() {
    let (_dir, mut store, chat) = setup();
    let snapshot = store.snapshot().unwrap();
    let choice = choices(&store.connection, &store.config, &snapshot, &chat)
        .unwrap()
        .remove(0);
    let id = apply(
        &mut store,
        Action::GenerateLesson {
            category: LessonCategory::Practical,
            choice_id: Some(choice.id.clone()),
            conversation_id: chat.clone(),
            topic: choice.label,
            expected_revision: snapshot.revision,
        },
    )
    .entity_id;
    store.dispatch().unwrap();
    let d = store.dispatch().unwrap().unwrap();
    let data: Value = serde_json::from_str(&d.messages[1].content).unwrap();
    assert_eq!(data["selectedLessonChoice"]["id"], choice.id);
    assert!(data["selectedLessonChoice"]["functions"].is_array());
    store
        .finish(&d, Ok(completion(plan().to_string())))
        .unwrap();
    assert_eq!(
        owned(&store.connection, &chat, &id).unwrap().status,
        "ready"
    );
    let rev = store.snapshot().unwrap().revision;
    let c = command(
        &store,
        Action::GenerateLesson {
            category: LessonCategory::Practical,
            choice_id: Some("unavailable".into()),
            conversation_id: chat,
            topic: "Unknown".into(),
            expected_revision: rev,
        },
    );
    assert!(store.execute(c).is_err());
}

#[test]
#[ignore = "Lessons are disabled; retained lifecycle contract for a future re-enable"]
fn reading_lessons_use_the_selected_native_language_not_assumed_english() {
    for native in ["french", "arabic"] {
        let (_dir, mut store, chat) = setup();
        store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.explanationLanguage',?2,'$.explanationVarietyId',?3) WHERE conversation_id=?1", params![chat, native, store.config.language(native).unwrap().default_variety]).unwrap();
        let revision = store.snapshot().unwrap().revision;
        let id = apply(
            &mut store,
            Action::GenerateLesson {
                category: LessonCategory::Reading,
                choice_id: None,
                conversation_id: chat,
                topic: "Letters and sounds".into(),
                expected_revision: revision,
            },
        )
        .entity_id;
        let raw: String = store
            .connection
            .query_row("SELECT context FROM turns WHERE id=?1", [&id], |r| r.get(0))
            .unwrap();
        let captured: Value = serde_json::from_str(&raw).unwrap();
        let messages = prompt(&store.connection, &id, "lesson_generate", &captured).unwrap();
        let data: Value = serde_json::from_str(&messages[1].content).unwrap();
        assert_eq!(data["nativeLanguage"], native);
        assert_eq!(data["explanationLanguage"], native);
        assert_eq!(data["targetLanguage"], "spanish");
        assert_eq!(data["category"], "reading");
        assert!(messages[0].content.contains("sounds with no equivalent"));
        assert!(
            messages[0]
                .content
                .contains("never claim to assess spoken pronunciation")
        );
    }
}
