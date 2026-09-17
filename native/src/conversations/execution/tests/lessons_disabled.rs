use super::*;
#[test]
fn lesson_commands_are_rejected_without_creating_work() {
    let (_dir, mut store, conversation) = setup();
    for action in [
        Action::GenerateLesson {
            category: crate::learning::lessons::LessonCategory::Practical,
            choice_id: None,
            conversation_id: conversation.clone(),
            topic: "Travel".into(),
            expected_revision: 0,
        },
        Action::ControlLesson {
            conversation_id: conversation.clone(),
            lesson_id: "saved".into(),
            control: crate::learning::lessons::LessonControl::End,
            expected_revision: 0,
        },
        Action::AnswerLessonQuiz {
            conversation_id: conversation.clone(),
            lesson_id: "saved".into(),
            question_index: 0,
            option_index: 0,
        },
        Action::AskLessonCoach {
            conversation_id: conversation.clone(),
            lesson_id: "saved".into(),
            text: "Help".into(),
            expected_revision: 0,
        },
    ] {
        let error = store
            .execute(Command {
                session_id: store.session_id.clone(),
                action_id: id(),
                action,
            })
            .unwrap_err();
        assert!(error.message.contains("Lessons are disabled"));
    }
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(view.turns.is_empty() && view.lessons.is_empty() && view.lesson_choices.is_empty());
}
#[test]
fn queued_lesson_review_is_cancelled_while_chat_and_assessment_continue() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let operation = id();
    store
        .connection
        .execute(
            "INSERT INTO operations(id,turn_id,kind,state) VALUES(?1,?2,'lesson_review','ready')",
            params![operation, turn],
        )
        .unwrap();
    store.dispatch().unwrap();
    let state: String = store
        .connection
        .query_row(
            "SELECT state FROM operations WHERE id=?1",
            [operation],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(state, "cancelled");
    let persona = store.dispatch().unwrap().unwrap();
    store.finish(&persona, Ok(reply("Hola."))).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(view.messages.len(), 2);
    let raw: String = store
        .connection
        .query_row("SELECT context FROM turns WHERE id=?1", [turn], |r| {
            r.get(0)
        })
        .unwrap();
    let captured: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert!(captured["activeLesson"].is_null());
    assert_eq!(captured["skillCriteria"].as_array().unwrap().len(), 45);
}
