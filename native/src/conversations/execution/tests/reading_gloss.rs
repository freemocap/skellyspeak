use super::*;

#[test]
fn g2_siblings_finish_independently_and_failure_keeps_usage() {
    for gloss_first in [true, false] {
        let (_dir, mut store, conversation) = setup();
        let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola.");
        if gloss_first {
            store.finish(&gloss, Ok(reply("invalid json"))).unwrap();
        } else {
            store
                .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
                .unwrap();
        }
        assert_eq!(
            store
                .conversation_snapshot(&conversation, None)
                .unwrap()
                .turns[0]
                .state,
            "assisting"
        );
        if gloss_first {
            store
                .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
                .unwrap();
        } else {
            store.finish(&gloss, Ok(reply("invalid json"))).unwrap();
        }
        let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
        assert_eq!(snapshot.turns[0].state, "failed");
        assert_eq!(snapshot.messages[1].translation.as_deref(), Some("Hello."));
        assert!(snapshot.messages[1].word_gloss.is_none());
        assert_eq!(store.profile().unwrap().global.attempts, 3);
        assert_eq!(store.profile().unwrap().global.input_tokens, 63);
        assert!(!store.has_ready_work().unwrap());
    }
}

#[test]
fn gloss_retry_runs_alongside_speech_without_regenerating_siblings() {
    for speech_first in [true, false] {
        let (_dir, mut store, conversation) = setup();
        let (speech, mut helpers) = speech_children(&mut store, &conversation);
        let gloss_index = helpers
            .iter()
            .position(|d| d.gloss_source.is_some())
            .unwrap();
        let gloss = helpers.remove(gloss_index);
        let translation = helpers.pop().unwrap();
        store.finish(&gloss, Ok(reply(r#"{"spans":[]}"#))).unwrap();
        store
            .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
            .unwrap();
        let initial = store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages[1]
            .word_gloss
            .clone()
            .unwrap();
        assert_eq!(initial.coverage, GlossCoverage::Partial);

        let retry = store.dispatch().unwrap().unwrap();
        assert_eq!(retry.operation, gloss.operation);
        assert_ne!(retry.attempt, gloss.attempt);
        assert!(store.attempt_active(&speech.attempt).unwrap());
        assert!(store.attempt_active(&retry.attempt).unwrap());
        let running: i64 = store
            .connection
            .query_row(
                "SELECT count(*) FROM operations WHERE state='running'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(running, 2);
        assert!(store.dispatch().unwrap().is_none());
        assert_eq!(
            store
                .conversation_snapshot(&conversation, None)
                .unwrap()
                .messages[1]
                .word_gloss
                .as_ref(),
            Some(&initial)
        );

        let mut cache = crate::speech::cache::Cache::default();
        if speech_first {
            cache
                .insert(
                    store
                        .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
                        .unwrap()
                        .unwrap(),
                )
                .unwrap();
            assert!(store.attempt_active(&retry.attempt).unwrap());
            assert_eq!(
                store
                    .conversation_snapshot(&conversation, None)
                    .unwrap()
                    .messages[1]
                    .word_gloss
                    .as_ref(),
                Some(&initial)
            );
        }
        store.finish(&retry, Ok(gloss_reply())).unwrap();
        let published = store.conversation_snapshot(&conversation, None).unwrap();
        let saved = published.messages[1].word_gloss.as_ref().unwrap();
        assert_eq!(saved.source_message_id, initial.source_message_id);
        assert_eq!(saved.operation_id, gloss.operation);
        assert_eq!(saved.attempt_id, retry.attempt);
        if !speech_first {
            assert!(store.attempt_active(&speech.attempt).unwrap());
            cache
                .insert(
                    store
                        .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
                        .unwrap()
                        .unwrap(),
                )
                .unwrap();
        }
        assert!(matches!(
            store.speech_audio(&speech.operation, &cache).unwrap(),
            SpeechAudioState::Ready { .. }
        ));
        let final_view = store.conversation_snapshot(&conversation, None).unwrap();
        assert_eq!(final_view.turns[0].state, "succeeded");
        assert_eq!(final_view.messages.len(), 2);
        assert_eq!(final_view.messages[1].text, "Hola.");
        assert_eq!(
            final_view.messages[1].translation.as_deref(),
            Some("Hello.")
        );
        let attempts: Vec<(String,i64)> = store.connection.prepare(
            "SELECT o.kind,count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE a.requested_model!='local' GROUP BY o.kind ORDER BY o.kind"
        ).unwrap().query_map([], |r| Ok((r.get(0)?,r.get(1)?))).unwrap()
            .collect::<rusqlite::Result<_>>().unwrap();
        assert_eq!(
            attempts,
            vec![
                ("persona_reply".into(), 1),
                ("persona_speech".into(), 1),
                ("persona_word_gloss".into(), 2),
                ("reply_translation".into(), 1),
            ]
        );
        let usage = store.profile().unwrap().global;
        assert_eq!(usage.input_tokens, 4 * 21 + 12);
        assert_eq!(usage.output_tokens, 4 * 8 + 30);
        assert!(!store.has_ready_work().unwrap());
        assert!(store.dispatch().unwrap().is_none());
    }
}

#[test]
fn g2_partial_result_survives_scoped_retry_failure_and_restart() {
    let (dir, mut store, conversation) = setup();
    let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola.");
    store.finish(&gloss, Ok(reply(r#"{"spans":[]}"#))).unwrap();
    store
        .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
        .unwrap();
    let initial = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages[1]
        .word_gloss
        .clone()
        .unwrap();
    assert_eq!(initial.coverage, GlossCoverage::Partial);
    let retry = store.dispatch().unwrap().unwrap();
    assert_eq!(retry.operation, gloss.operation);
    assert_ne!(retry.attempt, gloss.attempt);
    store.finish(&retry, Ok(reply("broken"))).unwrap();
    store.finish(&gloss, Ok(gloss_reply())).unwrap();
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    for _ in 0..3 {
        let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
        assert_eq!(snapshot.messages[1].word_gloss.as_ref(), Some(&initial));
        assert_eq!(snapshot.messages[1].translation.as_deref(), Some("Hello."));
    }
    assert_eq!(store.profile().unwrap().global.attempts, 4);
    assert!(!store.has_ready_work().unwrap());
}

#[test]
fn g2_preflight_failure_creates_no_attempt_and_translation_completes() {
    let (_dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    store.execute(command).unwrap();
    isolate_coaching(&mut store);
    store.dispatch().unwrap();
    let parent = store.dispatch().unwrap().unwrap();
    store.finish(&parent, Ok(reply(&"a".repeat(4097)))).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(snapshot.messages[1].gloss_state.as_deref(), Some("failed"));
    assert!(snapshot.messages[1].gloss_error.is_some());
    let translation = store.dispatch().unwrap().unwrap();
    store
        .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
        .unwrap();
    assert_eq!(store.profile().unwrap().global.attempts, 2);
    assert!(!store.has_ready_work().unwrap());
}

#[test]
fn g2_success_orders_preserve_source_and_reads_do_not_schedule() {
    for gloss_first in [true, false] {
        let (_dir, mut store, conversation) = setup();
        let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola.");
        store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.explanationLanguage','french','$.explanationVarietyId','french-france') WHERE conversation_id=?1", [&conversation]).unwrap();
        assert_eq!(
            gloss
                .gloss_source
                .as_ref()
                .unwrap()
                .identity
                .explanation_language_id,
            "english"
        );
        if gloss_first {
            store.finish(&gloss, Ok(gloss_reply())).unwrap();
        } else {
            store
                .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
                .unwrap();
        }
        assert_eq!(
            store
                .conversation_snapshot(&conversation, None)
                .unwrap()
                .turns[0]
                .state,
            "assisting"
        );
        if gloss_first {
            store
                .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
                .unwrap();
        } else {
            store.finish(&gloss, Ok(gloss_reply())).unwrap();
        }
        for _ in 0..3 {
            let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
            assert_eq!(snapshot.turns[0].state, "succeeded");
            let view = snapshot.messages[1].word_gloss.as_ref().unwrap();
            assert_eq!(view.source_message_id, snapshot.messages[1].id);
            assert_eq!(view.explanation_language_id, "english");
            assert_eq!(snapshot.messages[1].translation.as_deref(), Some("Hello."));
            assert!(store.dispatch().unwrap().is_none());
        }
        assert_eq!(store.profile().unwrap().global.attempts, 3);
    }
}

#[test]
fn explicit_gloss_retries_check_archival_without_lifetime_limit() {
    let (_dir, mut store, conversation) = setup();
    let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola.");
    store.finish(&gloss, Ok(reply("invalid json"))).unwrap();
    store
        .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
        .unwrap();
    store
        .connection
        .execute(
            "UPDATE conversations SET archived=1 WHERE id=?1",
            [&conversation],
        )
        .unwrap();
    assert!(retry_gloss(&store.connection, &gloss.operation).is_err());
    store
        .connection
        .execute(
            "UPDATE conversations SET archived=0 WHERE id=?1",
            [&conversation],
        )
        .unwrap();
    store.connection.execute("UPDATE contacts SET archived=1 WHERE id=(SELECT contact_id FROM conversations WHERE id=?1)", [&conversation]).unwrap();
    assert!(retry_gloss(&store.connection, &gloss.operation).is_err());
    store
        .connection
        .execute("UPDATE contacts SET archived=0", [])
        .unwrap();
    for _ in 3..TURN_ATTEMPT_LIMIT + 4 {
        retry_gloss(&store.connection, &gloss.operation).unwrap();
        let next = store.dispatch().unwrap().unwrap();
        store.finish(&next, Ok(reply("bad output"))).unwrap();
    }
    assert_eq!(
        store.profile().unwrap().global.attempts,
        (TURN_ATTEMPT_LIMIT + 4) as i32
    );
    assert!(!store.has_ready_work().unwrap());
}

#[test]
fn g2_deleted_source_rejects_late_result_and_retry() {
    let (_dir, mut store, conversation) = setup();
    let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola.");
    store
        .connection
        .execute(
            "DELETE FROM messages WHERE id=?1",
            [&gloss.gloss_source.as_ref().unwrap().identity.message_id],
        )
        .unwrap();
    store.finish(&gloss, Ok(gloss_reply())).unwrap();
    assert!(retry_gloss(&store.connection, &gloss.operation).is_err());
    store
        .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
        .unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .len(),
        1
    );
}

#[test]
fn g2_restart_retry_admits_only_gloss_on_paused_turn() {
    let (dir, mut store, conversation) = setup();
    let command = send(&store, &conversation);
    store.execute(command).unwrap();
    isolate_coaching(&mut store);
    store.dispatch().unwrap();
    let parent = store.dispatch().unwrap().unwrap();
    store.finish(&parent, Ok(reply("Hola."))).unwrap();
    let gloss = store.dispatch().unwrap().unwrap();
    drop(store);
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    retry_gloss(&store.connection, &gloss.operation).unwrap();
    let retried = store.dispatch().unwrap().unwrap();
    assert_eq!(retried.operation, gloss.operation);
    assert!(store.dispatch().unwrap().is_none());
    store.finish(&retried, Ok(gloss_reply())).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(
        snapshot.messages[1].translation_state.as_deref(),
        Some("ready")
    );
    assert_eq!(snapshot.turns[0].state, "assisting");
}

#[test]
fn g2_cancel_and_revocation_block_publication_and_retry() {
    for revoke in [false, true] {
        let (_dir, mut store, conversation) = setup();
        let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola.");
        if revoke {
            store
                .set_hosted_connection(2, None, "fixture@example.invalid")
                .unwrap();
        } else {
            let turn = store
                .conversation_snapshot(&conversation, None)
                .unwrap()
                .turns[0]
                .id
                .clone();
            control_turn(&store.connection, &turn, TurnControl::Cancel).unwrap();
        }
        store.finish(&gloss, Ok(gloss_reply())).unwrap();
        store
            .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
            .unwrap();
        assert!(
            store
                .conversation_snapshot(&conversation, None)
                .unwrap()
                .messages[1]
                .word_gloss
                .is_none()
        );
        assert!(retry_gloss(&store.connection, &gloss.operation).is_err());
    }
}

#[test]
fn human_reading_publishes_before_reply_and_stays_bound_to_its_source() {
    let (dir, mut store, conversation) = setup();
    store.execute(send(&store, &conversation)).unwrap();
    store
        .connection
        .execute(
            "DELETE FROM operations WHERE kind IN ('skill_attribution','skill_assessment','skill_evidence','coach_feedback','conversation_feedback','coach_reaction')",
            [],
        )
        .unwrap();
    store.dispatch().unwrap();
    let persona = store.dispatch().unwrap().unwrap();
    let gloss = store.dispatch().unwrap().unwrap();
    let translation = store.dispatch().unwrap().unwrap();
    let source = gloss.gloss_source.as_ref().unwrap();
    assert_eq!(source.text, "Hola, ¿cómo estás?");
    assert_eq!(translation.messages[1].content, source.text);
    assert!(store.attempt_active(&persona.attempt).unwrap());
    assert!(store.dispatch().unwrap().is_none());
    store.finish(&gloss, Ok(gloss_reply())).unwrap();
    store
        .finish(
            &translation,
            Ok(translation_reply(&translation, "Hello, how are you?")),
        )
        .unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(view.messages.len(), 1);
    let user = &view.messages[0];
    assert_eq!(user.word_gloss.as_ref().unwrap().source_message_id, user.id);
    assert_eq!(user.translation.as_deref(), Some("Hello, how are you?"));
    // Partial help schedules one repair without a user retry.
    let mut retry = store.dispatch().unwrap().unwrap();
    retry.gloss_source.as_mut().unwrap().identity.message_id = "wrong-source".into();
    store.finish(&retry, Ok(gloss_reply())).unwrap();
    let view = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(view.messages[0].gloss_state.as_deref(), Some("failed"));
    assert!(view.messages[0].word_gloss.is_some());
    drop(store);
    let store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    let restored = store.conversation_snapshot(&conversation, None).unwrap();
    assert_eq!(restored.messages[0].translation, user.translation);
    assert_eq!(
        restored.messages[0]
            .word_gloss
            .as_ref()
            .unwrap()
            .source_message_id,
        user.id
    );
}

#[test]
fn explicit_reading_gloss_sends_the_same_request_as_a_word_gloss_turn() {
    let (_dir, mut store, conversation) = setup();
    let (turn, _translation) = gloss_children(&mut store, &conversation, "Hola.");
    let (variety, explanation, explanation_variety): (String, String, String) = store
        .connection
        .query_row(
            "SELECT json_extract(settings,'$.varietyId'),json_extract(settings,'$.explanationLanguage'),json_extract(settings,'$.explanationVarietyId') FROM conversation_settings WHERE conversation_id=?1",
            [&conversation],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();
    let request = crate::language::reading::Request::capture(
        &store,
        crate::language::reading::ReadingInput {
            reference_item: None,
            text: "Hola.".into(),
            language: "spanish".into(),
            variety: Some(variety),
            explanation,
            explanation_variety: Some(explanation_variety),
            aid: crate::language::reading::ReadingAid::WordGloss,
        },
    )
    .unwrap();
    let reading = request.word_gloss_dispatch().unwrap();
    assert_eq!(
        serde_json::to_value(&reading.messages).unwrap(),
        serde_json::to_value(&turn.messages).unwrap()
    );
    assert_eq!(reading.gloss_schema, turn.gloss_schema);
    assert!(reading.coaching_schema.is_none() && turn.coaching_schema.is_none());
    assert_eq!(reading.model, turn.model);
    assert_eq!(reading.temperature, turn.temperature);
    assert_eq!(reading.temperature, TASK_TEMPERATURE);
    assert_eq!(
        (reading.route, &reading.target.url, &reading.credential),
        (turn.route, &turn.target.url, &turn.credential)
    );
    let (reading_source, turn_source) = (
        reading.gloss_source.as_ref().unwrap(),
        turn.gloss_source.as_ref().unwrap(),
    );
    assert_eq!(reading_source.text, turn_source.text);
    assert_eq!(
        (
            &reading_source.identity.target_language_id,
            &reading_source.identity.explanation_language_id,
            &reading_source.identity.analysis_version
        ),
        (
            &turn_source.identity.target_language_id,
            &turn_source.identity.explanation_language_id,
            &turn_source.identity.analysis_version
        )
    );
    // Both engines accept independently valid spans and keep the rest unresolved.
    let partial = crate::conversations::gloss::recover_with_context(
        reading_source,
        &reply(r#"{"spans":[]}"#),
        &reading.operation,
        &reading.attempt,
        &request.context,
    )
    .unwrap()
    .0;
    assert_eq!(partial.coverage, GlossCoverage::Partial);
    store.finish(&turn, Ok(reply(r#"{"spans":[]}"#))).unwrap();
    let published = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .messages[1]
        .word_gloss
        .clone()
        .unwrap();
    assert_eq!(published.coverage, partial.coverage);
    assert_eq!(published.segments, partial.segments);
}
