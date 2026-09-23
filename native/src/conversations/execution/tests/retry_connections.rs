use super::*;

fn select_custom(store: &mut Store) {
    store.connection.execute("UPDATE ai_config SET custom_config=json_set(custom_config,'$.baseUrl','http://127.0.0.1:8765/v1','$.bearerAuth',json('false'))", []).unwrap();
    let revision = store.connection_config().unwrap().revision;
    store
        .select_route(revision, ConnectionRoute::Custom)
        .unwrap();
}

#[test]
fn saved_audio_survives_settings_changes_and_cache_loss_uses_current_route() {
    let (_dir, mut store, conversation) = setup();
    let (speech, others) = speech_children(&mut store, &conversation);
    let message = speech.speech_source.as_ref().unwrap().message_id.clone();
    let mut cache = crate::speech::cache::Cache::default();
    cache
        .insert(
            store
                .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
                .unwrap()
                .unwrap(),
        )
        .unwrap();
    for child in others {
        store.finish(&child, Err(fail("fixture"))).unwrap();
    }
    select_custom(&mut store);
    assert!(matches!(
        store.speech_audio(&speech.operation, &cache).unwrap(),
        SpeechAudioState::Ready { .. }
    ));
    assert_eq!(
        request_speech(&store.connection, &message, true).unwrap(),
        speech.operation
    );
    assert!(store.dispatch().unwrap().is_none());
    cache.remove_operation(&speech.operation);
    request_speech(&store.connection, &message, false).unwrap();
    let next = store.dispatch().unwrap().unwrap();
    assert_eq!(next.target.route, ConnectionRoute::Custom);
    assert_eq!(next.target.url, "http://127.0.0.1:8765/v1/audio/speech");
    assert!(next.credential.is_empty());
    assert_eq!(
        next.speech_source.as_ref().unwrap().text,
        speech.speech_source.as_ref().unwrap().text
    );
    assert!(
        store
            .finish_speech(&next, speech_outcome(Ok(vec![1; 44])))
            .unwrap()
            .is_some()
    );
}

#[test]
fn settings_revocation_keeps_accepted_text_retryable_and_rejects_old_publication() {
    let (_dir, mut store, conversation) = setup();
    let (speech, others) = speech_children(&mut store, &conversation);
    let message = speech.speech_source.as_ref().unwrap().message_id.clone();
    store
        .set_hosted_connection(2, Some("replacement-key"), "fixture@example.invalid")
        .unwrap();
    assert!(!store.attempt_active(&speech.attempt).unwrap());
    assert!(
        store
            .finish_speech(&speech, speech_outcome(Ok(vec![1; 44])))
            .unwrap()
            .is_none()
    );
    for child in others {
        assert!(!store.attempt_active(&child.attempt).unwrap());
    }
    request_speech(&store.connection, &message, false).unwrap();
    let next = store.dispatch().unwrap().unwrap();
    assert_eq!(next.credential, "replacement-key");
    assert!(
        store
            .finish_speech(&next, speech_outcome(Ok(vec![1; 44])))
            .unwrap()
            .is_some()
    );
}

#[test]
fn explicit_gloss_retry_uses_current_route_and_preserves_source_language() {
    let (_dir, mut store, conversation) = setup();
    let (gloss, translation) = gloss_children(&mut store, &conversation, "Hola.");
    store.finish(&gloss, Err(fail("fixture"))).unwrap();
    store
        .finish(&translation, Ok(translation_reply(&translation, "Hello.")))
        .unwrap();
    select_custom(&mut store);
    retry_gloss(&store.connection, &gloss.operation).unwrap();
    let next = store.dispatch().unwrap().unwrap();
    assert_eq!(next.operation, gloss.operation);
    assert_eq!(next.route, ConnectionRoute::Custom);
    assert_eq!(next.target.url, "http://127.0.0.1:8765/v1/operations");
    assert!(next.credential.is_empty());
    assert_eq!(
        next.gloss_source
            .as_ref()
            .unwrap()
            .identity
            .explanation_language_id,
        "english"
    );
    store.finish(&next, Ok(gloss_reply())).unwrap();
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    assert!(snapshot.messages[1].word_gloss.is_some());
    assert_eq!(snapshot.messages[1].translation.as_deref(), Some("Hello."));
}

#[test]
fn failed_turn_retries_current_endpoint_without_duplicating_user_text() {
    let (_dir, mut store, conversation) = setup();
    let first = begin(&mut store, &conversation);
    store.finish(&first, Err(fail("fixture"))).unwrap();
    let turn = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .turns[0]
        .id
        .clone();
    select_custom(&mut store);
    control_turn(&store.connection, &turn, TurnControl::Retry).unwrap();
    let next = store.dispatch().unwrap().unwrap();
    assert_eq!(next.route, ConnectionRoute::Custom);
    assert!(next.credential.is_empty());
    assert_eq!(
        next.messages.last().unwrap().content,
        first.messages.last().unwrap().content
    );
    store.finish(&next, Ok(reply("Hola."))).unwrap();
    assert_eq!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .len(),
        2
    );
}

#[test]
fn revocation_follows_retried_speech_route_instead_of_original_text_route() {
    let (_dir, mut store, conversation) = setup();
    let (speech, others) = speech_children(&mut store, &conversation);
    let message = speech.speech_source.as_ref().unwrap().message_id.clone();
    store
        .finish_speech(&speech, speech_outcome(Err(fail("fixture"))))
        .unwrap();
    for child in others {
        store.finish(&child, Err(fail("fixture"))).unwrap();
    }
    select_custom(&mut store);
    request_speech(&store.connection, &message, false).unwrap();
    let next = store.dispatch().unwrap().unwrap();
    invalidate(&store.connection, Some(ConnectionRoute::Custom)).unwrap();
    assert!(!store.attempt_active(&next.attempt).unwrap());
    assert!(
        store
            .finish_speech(&next, speech_outcome(Ok(vec![1; 44])))
            .unwrap()
            .is_none()
    );
}
