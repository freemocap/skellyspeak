use super::*;
fn fixture() -> (tempfile::TempDir, Store) {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("reading.sqlite3")).unwrap();
    store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl','http://127.0.0.1:8765/v1','$.bearerAuth',json('false'))", []).unwrap();
    (dir, store)
}
fn input() -> ReadingInput {
    ReadingInput {
        reference_item: None,
        text: "Hola".into(),
        language: "spanish".into(),
        variety: None,
        explanation: "english".into(),
        explanation_variety: None,
        aid: ReadingAid::WordGloss,
    }
}
#[test]
fn requests_are_bounded_single_use_and_source_owned() {
    let (_dir, store) = fixture();
    let registry = Registry::default();
    let mut invalid = input();
    invalid.text = "x".repeat(2049);
    assert!(registry.begin(&store, invalid).is_err());
    let id = registry.begin(&store, input()).unwrap();
    let request = registry.claim(&id).unwrap();
    assert_eq!(request.source().text, "Hola");
    assert!(registry.claim(&id).is_err());
    registry.cancel(&store, &id).unwrap();
    assert_eq!(
        request.validate_source(&store).unwrap_err().code,
        ErrorCode::Conflict
    );
    let receipt = finish(
        &store,
        &request,
        serde_json::json!({"providerId":"receipt-123","inputTokens":8}),
        Some(&request.stopped("cancelled")),
    )
    .unwrap();
    assert_eq!(receipt["state"], "cancelled");
    assert_eq!(receipt["response"]["providerId"], "receipt-123");
    assert_eq!(receipt["error"]["diagnostics"]["reason"], "cancelled");
    assert!(receipt["error"]["diagnostics"]["dispatched"].is_null());
    assert!(!receipt.to_string().contains("Hola"));
}
#[test]
fn connection_change_and_pause_revoke_reading_without_touching_messages() {
    let (_dir, store) = fixture();
    let request = Request::capture(&store, input()).unwrap();
    store
        .connection
        .execute("UPDATE ai_config SET revision=revision+1", [])
        .unwrap();
    let changed = request.validate_source(&store).unwrap_err();
    assert_eq!(
        changed.diagnostics.as_ref().unwrap()["reason"],
        "access_changed"
    );
    assert!(changed.diagnostics.as_ref().unwrap()["dispatched"].is_null());
    store
        .connection
        .execute("UPDATE ai_config SET paused=1", [])
        .unwrap();
    let paused = Request::capture(&store, input())
        .unwrap()
        .validate_execution(&store)
        .unwrap_err();
    assert_eq!(paused.diagnostics.as_ref().unwrap()["reason"], "paused");
}
#[test]
fn recovery_preserves_unknown_billing_and_metadata() {
    let (_dir, store) = fixture();
    let registry = Registry::default();
    let pending = registry.begin(&store, input()).unwrap();
    let active = registry.begin(&store, input()).unwrap();
    registry.claim(&active).unwrap();
    crate::ai::results::begin(&store.connection, "shared", "reading_gloss").unwrap();
    crate::ai::results::dispatched(&store.connection, "shared").unwrap();
    crate::ai::results::associate(&store.connection, &active, "shared").unwrap();
    crate::ai::results::initialize(&store.connection).unwrap();
    recover(&store.connection).unwrap();
    let receipts = activity(&store).unwrap();
    assert!(
        receipts
            .iter()
            .any(|r| r["id"] == pending && r["state"] == "cancelled")
    );
    assert!(receipts.iter().any(|r| r["id"] == active
        && r["state"] == "cancelled"
        && r["sourceExecution"]["state"] == "unknown"));
}

#[test]
fn reading_speech_uses_language_capability_and_keeps_canonical_tag() {
    let (_dir, store) = fixture();
    let mut source = input();
    source.aid = ReadingAid::Speech;
    source.language = "irish".into();
    source.text = "Go raibh maith agat".into();
    let request = Request::capture(&store, source.clone()).unwrap();
    assert_eq!(request.target.model, "eleven_v3");
    assert_eq!(
        request.target.audio_resolution.as_ref().unwrap().provider,
        "elevenlabs"
    );
    assert_eq!(request.speech_input().unwrap().language_tag, "ga");
    request.validate_execution(&store).unwrap();
    source.language = "unsupported-language".into();
    assert!(Request::capture(&store, source).is_err());
}
