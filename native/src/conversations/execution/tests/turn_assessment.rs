//! Combined assessment owns understanding and skill evidence in one transaction.
use super::*;
use serde_json::{Value, json};

#[test]
fn credit_failure_rolls_back_the_whole_assessment_and_retry_credits_once() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let work = skill_assessment::assessment(&mut store, &turn);
    let result = skill_assessment::presence(
        &work,
        &[
            ("time_events", "direct"),
            ("understandability", "understandable"),
        ],
    );
    store.connection.execute_batch("CREATE TRIGGER reject_effort BEFORE INSERT ON effort_awards BEGIN SELECT RAISE(ABORT,'Injected award failure'); END;").unwrap();
    assert!(store.finish(&work, Ok(result.clone())).is_err());
    assert!(wave2_context(&store, &turn)["skillAssessment"].is_null());
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM message_assessments WHERE attempt_id=?1",
                [&work.attempt],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        0
    );
    store
        .connection
        .execute_batch("DROP TRIGGER reject_effort;")
        .unwrap();
    for _ in 0..2 {
        store.finish(&work, Ok(result.clone())).unwrap();
    }
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        1
    );
    let saved: (i64, String) = store
        .connection
        .query_row(
            "SELECT count(*),policy FROM effort_awards WHERE dimension='partner_understood'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(saved, (1, "jev-understandability-1".into()));
}

#[test]
fn one_assessment_publishes_understanding_before_reply_and_credits_once() {
    let (dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let removed: i64 = store.connection.query_row("SELECT count(*) FROM operations WHERE turn_id=?1 AND kind IN ('conversation_feedback','coach_reaction')", [&turn], |r| r.get(0)).unwrap();
    assert_eq!(removed, 0);
    store.connection.execute("DELETE FROM operations WHERE turn_id=?1 AND kind NOT IN ('persona_context','persona_reply','skill_assessment')", [&turn]).unwrap();
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    let assessment = store.dispatch().unwrap().unwrap();
    let request = assessment.decisions.as_ref().unwrap();
    assert_eq!(request["questions"].as_object().unwrap().len(), 10);
    assert!(request["state"].get("actualPartnerReply").is_none());
    let result = skill_assessment::presence(
        &assessment,
        &[
            ("understandability", "understandable"),
            ("grammar", "local_errors"),
        ],
    );
    for _ in 0..2 {
        store.finish(&assessment, Ok(result.clone())).unwrap();
    }
    let saved = wave2_context(&store, &turn);
    assert_eq!(
        saved["skillAssessment"]["grammar"]["choice"],
        "local_errors"
    );
    assert_eq!(
        saved["skillAssessment"]["understandability"]["choice"],
        "understandable"
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM effort_awards WHERE dimension='partner_understood'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        1
    );
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        0
    );
    store.finish(&persona, Ok(reply("Hola."))).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    let feedback = view.messages[0].conversation_feedback.as_ref().unwrap();
    assert_eq!(feedback.grammar, None);
    assert_eq!(feedback.conversation, None);
    assert_eq!(feedback.answers["grammar"].choice, "local_errors");
    assert_eq!(
        feedback.answers["understandability"].choice,
        "understandable"
    );
    assert_eq!(
        serde_json::to_value(&feedback.answers["grammar"]).unwrap(),
        saved["skillAssessment"]["grammar"]
    );
    let history = store
        .message_history(&conversation, &view.messages[0].id)
        .unwrap();
    assert_eq!(
        serde_json::to_value(&history.versions[0].conversation_feedback).unwrap(),
        serde_json::to_value(feedback).unwrap()
    );
    assert!(matches!(
        view.messages[1].reaction.as_ref().unwrap().kind,
        crate::partners::partner_reaction::ReactionKind::Understood
    ));
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    let reopened = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(
        serde_json::to_value(&reopened.messages[0].conversation_feedback).unwrap(),
        serde_json::to_value(feedback).unwrap()
    );
    assert_eq!(
        wave2_context(&store, &turn)["skillAssessment"],
        saved["skillAssessment"]
    );
    assert_eq!(
        crate::learning::effort::read(&store.connection, "spanish")
            .unwrap()
            .partner_understood,
        1
    );
}

#[test]
fn missing_message_judgment_rejects_skill_credit_without_blocking_the_reply() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let work = skill_assessment::assessment(&mut store, &turn);
    let mut result = skill_assessment::presence(&work, &[("time_events", "direct")]);
    let mut raw: Value = serde_json::from_str(&result.text).unwrap();
    raw.as_object_mut().unwrap().remove("grammar");
    result.text = raw.to_string();
    store.finish(&work, Ok(result)).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(view.messages.len(), 2);
    assert!(view.messages[1].reaction.is_none());
    assert!(view.messages[1].reaction_error.is_some());
    assert!(view.messages[0].feedback_error.is_some());
    assert!(view.messages[0].conversation_feedback.is_none());
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        0
    );
}

#[test]
fn reassessment_does_not_present_a_saved_success_as_current() {
    let (_dir, mut store, conversation) = setup();
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let work = skill_assessment::assessment(&mut store, &turn);
    let result = skill_assessment::presence(&work, &[("grammar", "acceptable")]);
    store.finish(&work, Ok(result)).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(view.messages[0].conversation_feedback.is_some());
    for state in ["queued", "running", "failed", "cancelled"] {
        store
            .connection
            .execute(
                "UPDATE operations SET state=?2 WHERE turn_id=?1 AND kind='skill_assessment'",
                rusqlite::params![turn, state],
            )
            .unwrap();
        let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
        assert!(
            snapshot.messages[0].conversation_feedback.is_none(),
            "{state}"
        );
        let history = store
            .message_history(&conversation, &snapshot.messages[0].id)
            .unwrap();
        assert!(
            history.versions[0].conversation_feedback.is_none(),
            "{state}"
        );
    }
    let retained: i64 = store
        .connection
        .query_row(
            "SELECT count(*) FROM message_assessments WHERE attempt_id=?1",
            [&work.attempt],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(retained, 1);
}

#[test]
fn abstention_and_nonunderstanding_do_not_award_understood_credit() {
    for choice in [
        "insufficient_evidence",
        "needs_clarification",
        "unrecoverable",
    ] {
        let (_dir, mut store, conversation) = setup();
        let turn = store
            .execute(send(&store, &conversation))
            .unwrap()
            .entity_id;
        let work = skill_assessment::assessment(&mut store, &turn);
        let result = skill_assessment::presence(&work, &[("understandability", choice)]);
        store.finish(&work, Ok(result)).unwrap();
        assert_eq!(
            crate::learning::effort::read(&store.connection, "spanish")
                .unwrap()
                .partner_understood,
            0
        );
        let saved = wave2_context(&store, &turn);
        assert_eq!(
            saved["skillAssessment"]["understandability"]["choice"],
            choice
        );
        if choice == "insufficient_evidence" {
            assert_eq!(saved["partnerReaction"], Value::Null);
        } else {
            assert_eq!(saved["partnerReaction"]["kind"], json!("confused"));
        }
    }
}
