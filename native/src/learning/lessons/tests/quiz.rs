use super::*;

#[test]
fn quiz_grades_once_and_awards_only_one_bonus_xp_without_skill_evidence() {
    let (dir, mut store, chat) = setup();
    let id = generate_ready(&mut store, &chat);
    let action = Action::AnswerLessonQuiz {
        conversation_id: chat.clone(),
        lesson_id: id.clone(),
        question_index: 0,
        option_index: 0,
    };
    let cmd = command(&store, action.clone());
    store.execute(cmd.clone()).unwrap();
    store.execute(cmd).unwrap();
    apply(&mut store, action);
    apply(
        &mut store,
        Action::AnswerLessonQuiz {
            conversation_id: chat.clone(),
            lesson_id: id.clone(),
            question_index: 1,
            option_index: 0,
        },
    );
    let lesson = owned(&store.connection, &chat, &id).unwrap();
    assert_eq!(lesson.quiz_answers.len(), 2);
    assert_eq!(lesson.quiz_answers.iter().map(|a| a.xp).sum::<u32>(), 1);
    let profile = crate::learning::learner::progression::snapshot(&store, "spanish").unwrap();
    assert_eq!(profile["profile"]["xp"], 1);
    assert_eq!(profile["profile"]["credits"], json!([]));
    assert_eq!(profile["records"], json!([]));
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "english").unwrap()["profile"]["xp"],
        0
    );
    for (question, option) in [(0, 1), (2, 0), (1, 3)] {
        let cmd = command(
            &store,
            Action::AnswerLessonQuiz {
                conversation_id: chat.clone(),
                lesson_id: id.clone(),
                question_index: question,
                option_index: option,
            },
        );
        assert!(store.execute(cmd).is_err());
    }
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        owned(&store.connection, &chat, &id)
            .unwrap()
            .quiz_answers
            .len(),
        2
    );
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        1
    );
}

#[test]
fn malformed_quizzes_are_rejected_before_publication() {
    let (_dir, store, _chat) = setup();
    for case in 0..4 {
        let mut value = plan();
        match case {
            0 => value["quiz"] = json!([]),
            1 => value["quiz"][0]["correctOption"] = json!(3),
            2 => value["quiz"][0]["options"] = json!(["same", " SAME ", "other"]),
            _ => value["quiz"][0]["explanation"] = json!(""),
        }
        assert!(
            validate(
                &store.connection,
                "unused",
                "lesson_generate",
                &completion(value.to_string())
            )
            .is_err()
        );
    }
}
