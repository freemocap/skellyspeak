use super::*;

#[test]
fn speech_siblings_partial_arrival_and_read_only_cache() {
    for speech_first in [true, false] {
        let (_dir, mut store, conversation) = setup();
        let (speech, others) = speech_children(&mut store, &conversation);
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
        }
        for child in others {
            store
                .finish(&child, Err(fail("synthetic helper failure")))
                .unwrap();
        }
        if !speech_first {
            assert_eq!(
                store
                    .conversation_snapshot(&conversation, None)
                    .unwrap()
                    .turns[0]
                    .state,
                "assisting"
            );
            cache
                .insert(
                    store
                        .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
                        .unwrap()
                        .unwrap(),
                )
                .unwrap();
        }
        let before: i64 = store
            .connection
            .query_row("SELECT count(*) FROM attempts", [], |r| r.get(0))
            .unwrap();
        for _ in 0..20 {
            assert!(matches!(
                store.speech_audio(&speech.operation, &cache).unwrap(),
                SpeechAudioState::Ready { .. }
            ));
            store.conversation_snapshot(&conversation, None).unwrap();
        }
        assert_eq!(
            store
                .connection
                .query_row("SELECT count(*) FROM attempts", [], |r| r.get::<_, i64>(0))
                .unwrap(),
            before
        );
        let message = &speech.speech_source.as_ref().unwrap().message_id;
        assert_eq!(
            request_speech(&store.connection, message, true).unwrap(),
            speech.operation
        );
        // A new Send remains admissible after speech and sibling failure.
        let command = send(&store, &conversation);
        store.execute(command).unwrap();
        isolate_coaching(&mut store);
        cache.remove_operation(&speech.operation);
        assert!(matches!(
            store.speech_audio(&speech.operation, &cache).unwrap(),
            SpeechAudioState::Unavailable {
                reason: SpeechUnavailableReason::Expired,
                ..
            }
        ));
    }
}

#[test]
fn speech_cancellation_defeats_late_publication_and_keeps_usage() {
    let (_dir, mut store, conversation) = setup();
    let (speech, others) = speech_children(&mut store, &conversation);
    cancel_speech(&store.connection, &speech.operation).unwrap();
    assert!(!store.attempt_active(&speech.attempt).unwrap());
    assert!(
        store
            .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
            .unwrap()
            .is_none()
    );
    let (state, tokens): (String, i32) = store
        .connection
        .query_row(
            "SELECT state,output_tokens FROM attempts WHERE id=?1",
            [&speech.attempt],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!((state.as_str(), tokens), ("unknown", 30));
    for child in others {
        assert!(store.attempt_active(&child.attempt).unwrap());
    }
    assert!(matches!(
        store
            .speech_audio(&speech.operation, &crate::speech::cache::Cache::default())
            .unwrap(),
        SpeechAudioState::Unavailable {
            reason: SpeechUnavailableReason::Cancelled,
            ..
        }
    ));
}

#[test]
fn explicit_speech_requests_outlive_attempt_budgets_without_regenerating_siblings() {
    for succeeds in [false, true] {
        let (_dir, mut store, conversation) = setup();
        let (mut speech, others) = speech_children(&mut store, &conversation);
        for child in others {
            store.finish(&child, Err(fail("helper failure"))).unwrap();
        }
        let operation = speech.operation.clone();
        let message = speech.speech_source.as_ref().unwrap().message_id.clone();
        let siblings: i64 = store
            .connection
            .query_row(
                "SELECT count(*) FROM attempts WHERE operation_id != ?1",
                [&operation],
                |r| r.get(0),
            )
            .unwrap();
        // Cover both the old three-generation cap and the total turn budget.
        for number in 1..=TURN_ATTEMPT_LIMIT + 2 {
            let audio = if succeeds {
                Ok(vec![1; 44])
            } else {
                Err(fail("invalid audio"))
            };
            assert_eq!(
                store
                    .finish_speech(&speech, speech_outcome(audio))
                    .unwrap()
                    .is_some(),
                succeeds
            );
            assert_eq!(
                store
                    .connection
                    .query_row(
                        "SELECT count(*) FROM attempts WHERE operation_id=?1",
                        [&operation],
                        |r| r.get::<_, i64>(0),
                    )
                    .unwrap(),
                number
            );
            // Completion or failure never creates an automatic retry.
            assert!(store.dispatch().unwrap().is_none());
            if number < TURN_ATTEMPT_LIMIT + 2 {
                for _ in 0..2 {
                    assert_eq!(
                        request_speech(&store.connection, &message, false).unwrap(),
                        operation
                    );
                }
                speech = store.dispatch().unwrap().unwrap();
                assert_eq!(speech.operation, operation);
                // A repeated click while running does not dispatch duplicate work.
                assert_eq!(
                    request_speech(&store.connection, &message, false).unwrap(),
                    operation
                );
                assert!(store.dispatch().unwrap().is_none());
            }
        }
        assert_eq!(
            store
                .connection
                .query_row(
                    "SELECT count(*) FROM attempts WHERE operation_id != ?1",
                    [&operation],
                    |r| r.get::<_, i64>(0),
                )
                .unwrap(),
            siblings
        );
    }
}

#[test]
fn speech_restart_cancels_queued_work_and_does_not_replay_success() {
    let (_dir, mut store, conversation) = setup();
    let (speech, others) = speech_children(&mut store, &conversation);
    store.reconcile_execution().unwrap();
    assert!(!store.attempt_active(&speech.attempt).unwrap());
    assert!(
        store
            .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
            .unwrap()
            .is_none()
    );
    assert!(store.dispatch().unwrap().is_none());
    for child in others {
        assert!(!store.attempt_active(&child.attempt).unwrap());
    }
    let (_dir, mut store, conversation) = setup();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.readAloud',json('true')) WHERE conversation_id=?1",[&conversation]).unwrap();
    let command = send(&store, &conversation);
    store.execute(command).unwrap();
    isolate_coaching(&mut store);
    store.reconcile_execution().unwrap();
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT state FROM operations WHERE kind='persona_speech'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "cancelled"
    );
    assert_eq!(
        store
            .connection
            .query_row("SELECT count(*) FROM attempts", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        0
    );
}

#[test]
fn speech_source_edit_and_route_revocation_reject_publication() {
    for route_change in [true, false] {
        let (_dir, mut store, conversation) = setup();
        let (speech, _) = speech_children(&mut store, &conversation);
        if route_change {
            invalidate(&store.connection, Some(speech.target.route)).unwrap();
        } else {
            store
                .connection
                .execute(
                    "UPDATE messages SET text='Changed' WHERE id=?1",
                    [&speech.speech_source.as_ref().unwrap().message_id],
                )
                .unwrap();
        }
        assert!(
            store
                .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
                .unwrap()
                .is_none()
        );
        let audio = store.speech_audio(&speech.operation, &crate::speech::cache::Cache::default());
        if route_change {
            assert!(matches!(
                audio.unwrap(),
                SpeechAudioState::Unavailable {
                    reason: SpeechUnavailableReason::Failed,
                    ..
                }
            ));
        } else {
            assert!(audio.is_err());
        }
        assert_eq!(
            store
                .connection
                .query_row(
                    "SELECT output_tokens FROM attempts WHERE id=?1",
                    [&speech.attempt],
                    |r| r.get::<_, i32>(0)
                )
                .unwrap(),
            30
        );
    }
}

#[test]
fn changing_audio_settings_preserves_in_flight_speech_and_usage() {
    let (_dir, mut store, conversation) = setup();
    let (speech, _) = speech_children(&mut store, &conversation);
    let config = store.connection_config().unwrap();
    let mut audio = config.audio.clone();
    audio.speech.model = "new-speech-model".into();
    store
        .set_models(
            config.revision,
            &config.standard_model,
            &config.fast_model,
            &audio,
            AssessmentAdapter::ChatModel,
        )
        .unwrap();
    assert_eq!(store.connection_config().unwrap().route, config.route);
    assert_eq!(speech.target.model, config.audio.speech.model);
    assert!(
        store
            .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
            .unwrap()
            .is_some()
    );
    let tokens: i32 = store
        .connection
        .query_row(
            "SELECT output_tokens FROM attempts WHERE id=?1",
            [&speech.attempt],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(tokens, 30);
}

#[test]
fn unavailable_speech_retains_provider_failure_and_request_metadata() {
    let (_dir, mut store, conversation) = setup();
    let (speech, _) = speech_children(&mut store, &conversation);
    let error = AppError::new(ErrorCode::Provider, "The selected model does not support audio.")
        .with_diagnostics(serde_json::json!({"request_id":"req-speech-7", "status":400, "error":{"code":"unsupported_audio", "message":"Choose a speech-capable model."}}));
    store
        .finish_speech(&speech, speech_outcome(Err(error)))
        .unwrap();
    let state = store
        .speech_audio(&speech.operation, &crate::speech::cache::Cache::default())
        .unwrap();
    let SpeechAudioState::Unavailable {
        message,
        attempt_id,
        diagnostics,
        ..
    } = state
    else {
        panic!("expected unavailable speech")
    };
    assert_eq!(message, "The selected model does not support audio.");
    assert_eq!(attempt_id.as_deref(), Some(speech.attempt.as_str()));
    let diagnostic = diagnostics.unwrap().to_string();
    assert!(diagnostic.contains("req-speech-7"));
    assert!(diagnostic.contains("unsupported_audio"));
}

#[test]
fn unavailable_speech_retains_admission_failure_before_a_new_attempt() {
    let (_dir, mut store, conversation) = setup();
    let (speech, _) = speech_children(&mut store, &conversation);
    let error = AppError::new(
        ErrorCode::AdmissionHeld,
        "Speech is held by the service rate limit.",
    )
    .with_diagnostics(serde_json::json!({"request_id":"req-admission", "retry_after":30}));
    store
        .connection
        .execute(
            "UPDATE operations SET state='failed' WHERE id=?1",
            [&speech.operation],
        )
        .unwrap();
    store.connection.execute("UPDATE turns SET context=json_set(context,'$.speechError',json(?2)) WHERE id=(SELECT turn_id FROM operations WHERE id=?1)", params![speech.operation, serde_json::to_string(&error).unwrap()]).unwrap();
    let state = store
        .speech_audio(&speech.operation, &crate::speech::cache::Cache::default())
        .unwrap();
    let SpeechAudioState::Unavailable {
        message,
        diagnostics,
        ..
    } = state
    else {
        panic!("expected unavailable speech")
    };
    assert_eq!(message, error.message);
    assert_eq!(
        diagnostics.unwrap()["diagnostics"]["request_id"],
        "req-admission"
    );
}
