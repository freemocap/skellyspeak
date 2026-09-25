use super::*;
use crate::ai::results;

#[test]
fn conversation_reuses_independent_result_while_paused_and_reopens_without_credentials() {
    let (dir, mut store, conversation) = setup();
    let (speech, others) = speech_children(&mut store, &conversation);
    cancel_speech(&store.connection, &speech.operation).unwrap();
    for child in others {
        store.finish(&child, Err(fail("fixture stopped"))).unwrap();
    }
    let source = speech.speech_source.as_ref().unwrap();
    let input = crate::ai::audio::SpeechInput {
        language_tag: source.language_tag.clone(),
        text: source.text.clone(),
        language: source.language.clone(),
        voice: source.voice.clone(),
    };
    let scope = results::speech::scope(&speech.target, &speech.install_id).unwrap();
    let key = results::speech::request_key(&scope, &input).unwrap();
    results::begin(&store.connection, "independent-execution", "speech").unwrap();
    results::dispatched(&store.connection, "independent-execution").unwrap();
    results::finish(
        &store.connection,
        "independent-execution",
        &key,
        &serde_json::json!({"providerId":"receipt","costMicros":null}),
        Some(
            &serde_json::to_vec(&crate::speech::alignment::SpeechAudio::new(&[1; 44], None))
                .unwrap(),
        ),
        None,
    )
    .unwrap();
    results::associate(
        &store.connection,
        "independent-consumer",
        "independent-execution",
    )
    .unwrap();
    store
        .connection
        .execute("UPDATE ai_config SET paused=1", [])
        .unwrap();
    let operation = request_speech(&store.connection, &source.message_id, false).unwrap();
    let SpeechAudioState::Ready { attempt_id, .. } = store
        .speech_audio(&operation, &store.speech_delivery)
        .unwrap()
    else {
        panic!("expected shared audio")
    };
    assert_eq!(
        results::receipt_for_consumer(&store.connection, &attempt_id)
            .unwrap()
            .unwrap()["id"],
        "independent-execution"
    );
    let requested: String = store
        .connection
        .query_row(
            "SELECT requested_model FROM attempts WHERE id=?1",
            [&attempt_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(requested, "local");
    // Existing result associations need neither credentials nor a running service.
    store
        .connection
        .execute("UPDATE ai_config SET hosted_credential_id=NULL", [])
        .unwrap();
    drop(store);
    let reopened = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert!(matches!(
        reopened
            .speech_audio(&operation, &reopened.speech_delivery)
            .unwrap(),
        SpeechAudioState::Ready { .. }
    ));
    let executions: i64 = reopened
        .connection
        .query_row("SELECT count(*) FROM inference_executions", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(executions, 1);
    reopened
        .connection
        .execute(
            "UPDATE messages SET text='changed' WHERE id=?1",
            [&source.message_id],
        )
        .unwrap();
    assert!(
        reopened
            .speech_audio(&operation, &reopened.speech_delivery)
            .is_err()
    );
}
