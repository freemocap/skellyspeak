use super::*;
use crate::configuration::execution::{ExecutionMode, ExecutionPreferences};

fn policy(store: &mut Store, execution: ExecutionPreferences) {
    let learner = store.snapshot().unwrap().learner;
    let mut preferences = learner.preferences;
    preferences.execution = execution;
    apply(
        store,
        Action::UpdateLearner {
            expected_revision: learner.revision,
            name: learner.name,
            preferences,
        },
    );
}

fn kinds(store: &Store, turn: &str) -> Vec<String> {
    store
        .connection
        .prepare("SELECT kind FROM operations WHERE turn_id=?1 ORDER BY kind")
        .unwrap()
        .query_map([turn], |r| r.get(0))
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap()
}

fn drain_coaching(store: &mut Store) {
    let pending: bool = store
        .connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM operations WHERE kind='coach_feedback' AND state='ready')",
            [],
            |r| r.get(0),
        )
        .unwrap();
    if pending {
        let work = store.dispatch().unwrap().unwrap();
        assert_eq!(
            store
                .connection
                .query_row(
                    "SELECT kind FROM operations WHERE id=?1",
                    [&work.operation],
                    |r| r.get::<_, String>(0)
                )
                .unwrap(),
            "coach_feedback"
        );
        store
            .finish(
                &work,
                Ok(reply(r#"{"meaning_recovered":"full","items":[]}"#)),
            )
            .unwrap();
    }
}

fn help(store: &mut Store, message: &str, help: MessageHelp, retry: bool) -> Receipt {
    apply(
        store,
        Action::RequestMessageHelp {
            message_id: message.into(),
            help,
            retry,
        },
    )
}

#[test]
fn coaching_is_automatic_and_reply_publication_does_not_wait_for_it() {
    let (_dir, mut store, conversation) = setup();
    policy(
        &mut store,
        ExecutionPreferences {
            assessment: ExecutionMode::OnDemand,
            reply_brief: ExecutionMode::OnDemand,
            reading: ExecutionMode::OnDemand,
        },
    );
    let command = send(&store, &conversation);
    store.execute(command).unwrap();
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    let coaching = store.dispatch().unwrap().unwrap();
    store.finish(&persona, Ok(reply("Hola."))).unwrap();
    let visible = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(visible.messages[1].text, "Hola.");
    assert!(visible.messages[0].feedback.is_none());
    assert_eq!(
        visible.messages[0].feedback_state.as_deref(),
        Some("running")
    );
    let feedback =
        serde_json::json!({"meaning_recovered":"full","items":[wave2_error("¿cómo estás?")]});
    store
        .finish(&coaching, Ok(reply(&feedback.to_string())))
        .unwrap();
    let visible = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(
        !visible.messages[0]
            .feedback
            .as_ref()
            .unwrap()
            .issues
            .is_empty()
    );
    assert_eq!(visible.messages[1].text, "Hola.");
}

#[test]
fn defaults_schedule_reply_coaching_assessment_and_reading_without_backfill() {
    let (_dir, mut store, conversation) = setup();
    policy(&mut store, ExecutionPreferences::default());
    let revision = store.snapshot().unwrap().learner.revision;
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let expected = [
        "coach_feedback",
        "persona_context",
        "persona_reply",
        "persona_word_gloss",
        "reply_translation",
        "skill_assessment",
        "skill_attribution",
        "user_translation",
        "user_word_gloss",
    ];
    assert_eq!(kinds(&store, &turn), expected);
    let captured = wave2_context(&store, &turn);
    assert_eq!(captured["executionPreferencesRevision"], revision);
    assert_eq!(
        captured["executionPreferences"],
        serde_json::to_value(ExecutionPreferences::default()).unwrap()
    );
    let automatic = ExecutionPreferences {
        assessment: ExecutionMode::OnDemand,
        reply_brief: ExecutionMode::Automatic,
        reading: ExecutionMode::Automatic,
    };
    policy(&mut store, automatic);
    assert_eq!(kinds(&store, &turn), expected);
    assert_eq!(wave2_context(&store, &turn), captured);
}

#[test]
fn late_assessment_shares_pending_work_preserves_source_and_credits_once() {
    let (dir, mut store, conversation) = setup();
    let manual = ExecutionPreferences {
        assessment: ExecutionMode::OnDemand,
        reply_brief: ExecutionMode::OnDemand,
        reading: ExecutionMode::OnDemand,
    };
    policy(&mut store, manual.clone());
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    assert_eq!(
        kinds(&store, &turn),
        ["coach_feedback", "persona_context", "persona_reply"]
    );
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    store.finish(&persona, Ok(reply("Hola."))).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    let message = &view.messages[0].id;
    drain_coaching(&mut store);
    let operation = help(&mut store, message, MessageHelp::Assessment, false).entity_id;
    assert_eq!(
        help(&mut store, message, MessageHelp::Assessment, false).entity_id,
        operation
    );
    assert_eq!(kinds(&store, &turn).len(), 5);
    let work = store.dispatch().unwrap().unwrap();
    assert_eq!(work.operation, operation);
    assert_eq!(
        work.decisions.as_ref().unwrap()["state"]["currentLearnerMessage"],
        "Hola, ¿cómo estás?"
    );
    let result = skill_assessment::presence(
        &work,
        &[
            ("time_events", "direct"),
            ("understandability", "understandable"),
        ],
    );
    store.finish(&work, Ok(result.clone())).unwrap();
    store.finish(&work, Ok(result)).unwrap();
    assert_eq!(
        help(&mut store, message, MessageHelp::Assessment, false).entity_id,
        operation
    );
    assert_eq!(
        crate::learning::effort::read(&store.connection, "spanish")
            .unwrap()
            .partner_understood,
        1
    );
    assert_eq!(
        crate::learning::learner::progression::snapshot(&store, "spanish").unwrap()["profile"]["xp"],
        1
    );
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        store.snapshot().unwrap().learner.preferences.execution,
        manual
    );
    assert_eq!(
        crate::learning::effort::read(&store.connection, "spanish")
            .unwrap()
            .partner_understood,
        1
    );
}

#[test]
fn opening_failed_help_is_a_read_and_retry_is_explicit() {
    let (_dir, mut store, conversation) = setup();
    policy(
        &mut store,
        ExecutionPreferences {
            assessment: ExecutionMode::OnDemand,
            reply_brief: ExecutionMode::OnDemand,
            reading: ExecutionMode::OnDemand,
        },
    );
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    store.finish(&persona, Ok(reply("Hola."))).unwrap();
    let message = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages[0]
        .id
        .clone();
    drain_coaching(&mut store);
    let operation = help(&mut store, &message, MessageHelp::Assessment, false).entity_id;
    let work = store.dispatch().unwrap().unwrap();
    store
        .finish(
            &work,
            Err(AppError::new(ErrorCode::Provider, "Fixture failure.")),
        )
        .unwrap();
    assert_eq!(
        help(&mut store, &message, MessageHelp::Assessment, false).entity_id,
        operation
    );
    assert!(!store.has_ready_work().unwrap());
    help(&mut store, &message, MessageHelp::Assessment, true);
    let retry = store.dispatch().unwrap().unwrap();
    assert_eq!(retry.operation, operation);
    assert_ne!(retry.attempt, work.attempt);
    assert_eq!(kinds(&store, &turn).len(), 5);
}

#[test]
fn requesting_reading_before_reply_does_not_schedule_other_helpers() {
    let (_dir, mut store, conversation) = setup();
    policy(
        &mut store,
        ExecutionPreferences {
            assessment: ExecutionMode::OnDemand,
            reply_brief: ExecutionMode::OnDemand,
            reading: ExecutionMode::OnDemand,
        },
    );
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    let message = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages[0]
        .id
        .clone();
    drain_coaching(&mut store);
    let operation = help(&mut store, &message, MessageHelp::Translation, false).entity_id;
    assert_eq!(
        kinds(&store, &turn),
        [
            "coach_feedback",
            "persona_context",
            "persona_reply",
            "user_translation"
        ]
    );
    let state: String = store
        .connection
        .query_row(
            "SELECT state FROM operations WHERE id=?1",
            [operation],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(state, "waiting_dependencies");
    assert!(
        store
            .execute(Command {
                session_id: store.session_id.clone(),
                action_id: id(),
                action: Action::RequestMessageHelp {
                    message_id: message,
                    help: MessageHelp::ReplyBrief,
                    retry: false
                }
            })
            .is_err()
    );
}

#[test]
fn late_helpers_bind_current_access_and_reject_unavailable_sources() {
    let (_dir, mut store, conversation) = setup();
    policy(
        &mut store,
        ExecutionPreferences {
            assessment: ExecutionMode::OnDemand,
            reply_brief: ExecutionMode::OnDemand,
            reading: ExecutionMode::OnDemand,
        },
    );
    let turn = store
        .execute(send(&store, &conversation))
        .unwrap()
        .entity_id;
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    store.finish(&persona, Ok(reply("Hola."))).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    let captured = wave2_context(&store, &turn);
    store
        .connection
        .execute(
            "UPDATE ai_config SET fast_model='fixture-fast-current',revision=revision+1",
            [],
        )
        .unwrap();
    drain_coaching(&mut store);
    for (message, feature, kind) in [
        (
            &view.messages[0].id,
            MessageHelp::WordGloss,
            "user_word_gloss",
        ),
        (&view.messages[1].id, MessageHelp::ReplyBrief, "reply_brief"),
        (
            &view.messages[1].id,
            MessageHelp::WordGloss,
            "persona_word_gloss",
        ),
        (
            &view.messages[1].id,
            MessageHelp::Translation,
            "reply_translation",
        ),
    ] {
        drain_coaching(&mut store);
        let operation = help(&mut store, message, feature, false).entity_id;
        assert_eq!(
            help(&mut store, message, feature, false).entity_id,
            operation
        );
        let saved_kind: String = store
            .connection
            .query_row(
                "SELECT kind FROM operations WHERE id=?1",
                [&operation],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(saved_kind, kind);
        let after = wave2_context(&store, &turn);
        assert_eq!(
            after["retryTargets"][&operation]["fastModel"],
            "fixture-fast-current"
        );
        for key in [
            "messages",
            "sourceIds",
            "languageContext",
            "executionPreferences",
            "executionPreferencesRevision",
        ] {
            assert_eq!(after[key], captured[key], "{key}");
        }
    }
    store
        .connection
        .execute(
            "UPDATE conversations SET archived=1 WHERE id=?1",
            [&conversation],
        )
        .unwrap();
    assert!(
        store
            .execute(Command {
                session_id: store.session_id.clone(),
                action_id: id(),
                action: Action::RequestMessageHelp {
                    message_id: view.messages[0].id.clone(),
                    help: MessageHelp::Assessment,
                    retry: false
                }
            })
            .is_err()
    );
    assert!(!kinds(&store, &turn).contains(&"skill_assessment".into()));
}
