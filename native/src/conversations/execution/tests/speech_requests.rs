use super::*;

#[test]
fn speech_cancel_before_dispatch_and_manual_source_checks() {
    let (_dir, mut store, conversation) = setup();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.readAloud',json('true')) WHERE conversation_id=?1",[&conversation]).unwrap();
    let parent = begin(&mut store, &conversation);
    store.finish(&parent, Ok(reply("Hola."))).unwrap();
    let operation: String = store
        .connection
        .query_row(
            "SELECT id FROM operations WHERE kind='persona_speech'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    cancel_speech(&store.connection, &operation).unwrap();
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM attempts WHERE operation_id=?1",
                [&operation],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
    let message: String = store
        .connection
        .query_row("SELECT id FROM messages WHERE role='assistant'", [], |r| {
            r.get(0)
        })
        .unwrap();
    store
        .connection
        .execute("UPDATE ai_config SET paused=1", [])
        .unwrap();
    assert_eq!(
        request_speech(&store.connection, &message, false)
            .unwrap_err()
            .code,
        ErrorCode::AdmissionHeld
    );
    store
        .connection
        .execute("UPDATE ai_config SET paused=0", [])
        .unwrap();
    store
        .connection
        .execute(
            "UPDATE messages SET text='Edited source' WHERE id=?1",
            [&message],
        )
        .unwrap();
    assert!(request_speech(&store.connection, &message, false).is_err());
    let user: String = store
        .connection
        .query_row("SELECT id FROM messages WHERE role='user'", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert!(request_speech(&store.connection, &user, false).is_err());
}

#[test]
fn speech_saved_success_is_expired_after_reopen_without_new_work() {
    let (dir, mut store, conversation) = setup();
    let (speech, others) = speech_children(&mut store, &conversation);
    store
        .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
        .unwrap()
        .unwrap();
    for child in others {
        store
            .finish(&child, Err(fail("synthetic failure")))
            .unwrap();
    }
    let count: i64 = store
        .connection
        .query_row("SELECT count(*) FROM attempts", [], |r| r.get(0))
        .unwrap();
    drop(store);
    let mut reopened = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert!(matches!(
        reopened
            .speech_audio(&speech.operation, &crate::speech::cache::Cache::default())
            .unwrap(),
        SpeechAudioState::Unavailable {
            reason: SpeechUnavailableReason::Expired,
            ..
        }
    ));
    assert!(reopened.dispatch().unwrap().is_none());
    assert_eq!(
        reopened
            .connection
            .query_row("SELECT count(*) FROM attempts", [], |r| r.get::<_, i64>(0))
            .unwrap(),
        count
    );
}

#[test]
fn speech_payload_preflight_fails_before_attempt_without_harming_translation() {
    let (_dir, mut store, conversation) = setup();
    store.connection.execute("UPDATE conversation_settings SET settings=json_set(settings,'$.readAloud',json('true')) WHERE conversation_id=?1",[&conversation]).unwrap();
    let parent = begin(&mut store, &conversation);
    store
        .finish(&parent, Ok(reply(&"界".repeat(6000))))
        .unwrap();
    let mut translation = None;
    for _ in 0..2 {
        if let Some(dispatch) = store.dispatch().unwrap() {
            assert!(dispatch.speech_source.is_none());
            translation = Some(dispatch);
        }
    }
    let translation = translation.unwrap();
    store
        .finish(
            &translation,
            Ok(translation_reply(&translation, "Translated.")),
        )
        .unwrap();
    assert_eq!(store.connection.query_row("SELECT count(*) FROM attempts a JOIN operations o ON o.id=a.operation_id WHERE o.kind='persona_speech'",[],|r|r.get::<_,i64>(0)).unwrap(),0);
    let operation: String = store
        .connection
        .query_row(
            "SELECT id FROM operations WHERE kind='persona_speech'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    let SpeechAudioState::Unavailable {
        message,
        attempt_id,
        diagnostics,
        ..
    } = store
        .speech_audio(&operation, &crate::speech::cache::Cache::default())
        .unwrap()
    else {
        panic!("expected unavailable speech")
    };
    assert!(!message.contains("without a recorded explanation"));
    assert!(attempt_id.is_none());
    assert_eq!(diagnostics.unwrap()["code"], "validation");

    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT state FROM operations WHERE kind='persona_speech'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "failed"
    );
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .last()
            .unwrap()
            .translation
            .as_deref(),
        Some("Translated.")
    );
}

#[test]
fn speech_manual_action_replay_and_resident_audio_never_regenerate() {
    let (_dir, mut store, conversation) = setup();
    let parent = begin(&mut store, &conversation);
    store.finish(&parent, Ok(reply("Hola."))).unwrap();
    let translation = store.dispatch().unwrap().unwrap();
    store
        .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
        .unwrap();
    let message: String = store
        .connection
        .query_row("SELECT id FROM messages WHERE role='assistant'", [], |r| {
            r.get(0)
        })
        .unwrap();
    let command = Command {
        session_id: store.session_id.clone(),
        action_id: id(),
        action: Action::RequestMessageSpeech {
            message_id: message.clone(),
        },
    };
    let first = store.execute(command.clone()).unwrap();
    assert_eq!(
        store.execute(command.clone()).unwrap().entity_id,
        first.entity_id
    );
    let speech = store.dispatch().unwrap().unwrap();
    let audio = store
        .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
        .unwrap()
        .unwrap();
    store.speech_cache.insert(audio).unwrap();
    assert_eq!(store.execute(command).unwrap().entity_id, first.entity_id);
    for _ in 0..3 {
        let receipt = apply(
            &mut store,
            Action::RequestMessageSpeech {
                message_id: message.clone(),
            },
        );
        assert_eq!(receipt.entity_id, first.entity_id);
        assert!(store.dispatch().unwrap().is_none());
    }
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM attempts WHERE operation_id=?1",
                [&first.entity_id],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        1
    );
    store.speech_cache.remove_operation(&first.entity_id);
    apply(
        &mut store,
        Action::RequestMessageSpeech {
            message_id: message.clone(),
        },
    );
    let retry = store.dispatch().unwrap().unwrap();
    let audio = store
        .finish_speech(&retry, speech_outcome(Ok(vec![1; 44])))
        .unwrap()
        .unwrap();
    store.speech_cache.insert(audio).unwrap();
    apply(
        &mut store,
        Action::RequestMessageSpeech {
            message_id: message,
        },
    );
    assert!(store.dispatch().unwrap().is_none());
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM attempts WHERE operation_id=?1",
                [&first.entity_id],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        2
    );
}

#[test]
fn speech_and_helpers_leave_capacity_for_next_persona_reply() {
    let (_dir, mut store, conversation) = setup();
    let (speech, others) = speech_children(&mut store, &conversation);
    let command = send(&store, &conversation);
    store.execute(command).unwrap();
    isolate_coaching(&mut store);
    assert!(store.dispatch().unwrap().is_none()); // Local context.
    let next = store.dispatch().unwrap().unwrap();
    assert!(next.speech_source.is_none());
    assert!(store.attempt_active(&speech.attempt).unwrap());
    for helper in others {
        assert!(store.attempt_active(&helper.attempt).unwrap());
    }
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT count(*) FROM operations WHERE state='running'",
                [],
                |r| r.get::<_, i32>(0)
            )
            .unwrap(),
        4
    );
    assert!(store.dispatch().unwrap().is_none());
}

#[test]
fn speech_archive_revokes_dispatch_and_releases_durable_running_slot() {
    let (_dir, mut store, conversation) = setup();
    let (speech, _) = speech_children(&mut store, &conversation);
    let revision = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .revision;
    apply(
        &mut store,
        Action::UpdateConversation {
            conversation_id: conversation,
            expected_revision: revision,
            title: "Archived".into(),
            archived: true,
        },
    );
    assert!(!store.attempt_active(&speech.attempt).unwrap());
    assert!(
        store
            .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
            .unwrap()
            .is_none()
    );
    let (state, usage): (String, i32) = store
        .connection
        .query_row(
            "SELECT state,output_tokens FROM attempts WHERE id=?1",
            [&speech.attempt],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(state, "invalidated");
    assert_eq!(usage, 30);
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT state FROM operations WHERE id=?1",
                [&speech.operation],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "invalidated"
    );
}

#[test]
fn speech_validated_audio_is_independent_of_finish_metadata() {
    for (finish, audio_valid, published) in [
        (None, true, true),
        (None, false, false),
        (Some("length"), true, true),
        (Some("content_filter"), true, true),
    ] {
        let (_dir, mut store, conversation) = setup();
        let (speech, _) = speech_children(&mut store, &conversation);
        let mut outcome = speech_outcome(if audio_valid {
            Ok(vec![1; 44])
        } else {
            Err(fail("Missing terminal audio proof."))
        });
        outcome.finish_reason = finish.map(str::to_owned);
        outcome.input_tokens = Some(i32::MAX as u64 + 1);
        assert_eq!(
            store.finish_speech(&speech, outcome).unwrap().is_some(),
            published
        );
        let (state, tokens): (String, i32) = store
            .connection
            .query_row(
                "SELECT state,output_tokens FROM attempts WHERE id=?1",
                [&speech.attempt],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(state, if published { "succeeded" } else { "failed" });
        assert_eq!(tokens, 30);
        let context: String = store
            .connection
            .query_row(
                "SELECT t.context FROM turns t JOIN operations o ON o.turn_id=t.id WHERE o.id=?1",
                [&speech.operation],
                |r| r.get(0),
            )
            .unwrap();
        let context: serde_json::Value = serde_json::from_str(&context).unwrap();
        assert_eq!(
            context["speechUsageByAttempt"][&speech.attempt]["inputTokens"],
            serde_json::json!(i32::MAX as u64 + 1)
        );
        assert_eq!(
            context["speechUsageByAttempt"][&speech.attempt]["finishReason"],
            serde_json::json!(finish)
        );
    }
}

#[test]
fn explicit_reading_speech_sends_the_same_request_as_persona_speech() {
    let (_dir, mut store, conversation) = setup();
    let (speech, _helpers) = speech_children(&mut store, &conversation);
    assert_eq!(speech.route, ConnectionRoute::Hosted);
    let (variety, explanation, explanation_variety): (String, String, String) = store
        .connection
        .query_row(
            "SELECT json_extract(settings,'$.varietyId'),json_extract(settings,'$.explanationLanguage'),json_extract(settings,'$.explanationVarietyId') FROM conversation_settings WHERE conversation_id=?1",
            [&conversation],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();
    let input = |text: &str| crate::language::reading::ReadingInput {
        reference_item: None,
        text: text.into(),
        language: "spanish".into(),
        variety: Some(variety.clone()),
        explanation: explanation.clone(),
        explanation_variety: Some(explanation_variety.clone()),
        aid: crate::language::reading::ReadingAid::Speech,
    };
    let request = crate::language::reading::Request::capture(&store, input("Hola.")).unwrap();
    let reading = request.speech_input().unwrap();
    let persona = speech.speech_source.as_ref().unwrap();
    assert_eq!(
        (&reading.text, &reading.voice, &reading.language),
        (&persona.text, &persona.voice, &persona.language)
    );
    assert_eq!(request.model, speech.model);
    assert_eq!(
        (
            request.target.route,
            &request.target.url,
            &request.target.credential
        ),
        (speech.route, &speech.target.url, &speech.target.credential)
    );
    // A whole sentence is read aloud, not only a token.
    let sentence = "Hola, ¿cómo estás? ".repeat(20);
    assert!(sentence.encode_utf16().count() > 256);
    let long = crate::language::reading::Request::capture(&store, input(&sentence)).unwrap();
    assert_eq!(long.speech_input().unwrap().text, sentence);
}
