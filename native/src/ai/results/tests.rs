use super::*;
fn complete(db: &Connection, id: &str, key: &str, bytes: &[u8]) {
    begin(db, id, "test-task").unwrap();
    dispatched(db, id).unwrap();
    finish(
        db,
        id,
        key,
        &serde_json::json!({"request_id":id}),
        Some(bytes),
        None,
    )
    .unwrap();
}
#[test]
fn restart_reuse_lru_shared_blobs_and_receipts_have_independent_lifetimes() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("results.sqlite3");
    {
        let db = Connection::open(&path).unwrap();
        initialize(&db).unwrap();
        set_capacity(&db, 6).unwrap();
        complete(&db, "first", "one", b"aaa");
        complete(&db, "second", "two", b"bbb");
        complete(&db, "same-blob", "three", b"aaa");
        assert_eq!(settings(&db).unwrap().used_bytes, 6);
        assert_eq!(lookup(&db, "one").unwrap().unwrap().payload, b"aaa");
        complete(&db, "fourth", "four", b"ccc");
        assert!(lookup(&db, "two").unwrap().is_none());
        assert!(lookup(&db, "one").unwrap().is_some());
    }
    let db = Connection::open(&path).unwrap();
    initialize(&db).unwrap();
    assert_eq!(
        lookup(&db, "four").unwrap().unwrap().metadata["request_id"],
        "fourth"
    );
    set_capacity(&db, 0).unwrap();
    assert_eq!(settings(&db).unwrap().used_bytes, 0);
    assert_eq!(settings(&db).unwrap().result_count, 0);
    let receipts: i64 = db
        .query_row("SELECT count(*) FROM inference_executions", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(receipts, 4);
}
#[test]
fn interrupted_failed_and_oversized_payloads_are_not_reused() {
    let db = Connection::open_in_memory().unwrap();
    initialize(&db).unwrap();
    begin(&db, "pending", "test").unwrap();
    dispatched(&db, "pending").unwrap();
    initialize(&db).unwrap();
    assert_eq!(
        db.query_row(
            "SELECT state FROM inference_executions WHERE id='pending'",
            [],
            |r| r.get::<_, String>(0)
        )
        .unwrap(),
        "unknown"
    );
    begin(&db, "failed", "test").unwrap();
    let failure = AppError::new(ErrorCode::Provider, "failed");
    finish(
        &db,
        "failed",
        "key",
        &serde_json::json!({}),
        Some(b"partial"),
        Some(&failure),
    )
    .unwrap();
    assert!(lookup(&db, "key").unwrap().is_none());
    set_capacity(&db, 2).unwrap();
    complete(&db, "big", "big", b"abc");
    assert!(lookup(&db, "big").unwrap().is_none());
    assert!(finish(&db, "big", "big", &serde_json::json!({}), Some(b"a"), None).is_err());
}

#[test]
fn damaged_payload_and_unrecognized_schema_fail_without_resetting_data() {
    let db = Connection::open_in_memory().unwrap();
    initialize(&db).unwrap();
    complete(&db, "valid", "key", b"audio");
    db.execute(
        "UPDATE inference_blobs SET payload=?1",
        [b"broken".as_slice()],
    )
    .unwrap();
    assert!(matches!(lookup(&db,"key"),Err(e) if e.code == ErrorCode::Storage));
    db.execute_batch("ALTER TABLE inference_results ADD COLUMN unknown_field TEXT;")
        .unwrap();
    assert!(matches!(initialize(&db),Err(e) if e.code == ErrorCode::Storage));
    assert_eq!(
        db.query_row("SELECT count(*) FROM inference_executions", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        1
    );
}

#[test]
fn settlement_preserves_retry_metadata_and_explicit_unknown_cost() {
    let db = Connection::open_in_memory().unwrap();
    initialize(&db).unwrap();
    begin(&db, "retrying", "speech").unwrap();
    dispatched(&db, "retrying").unwrap();
    let mut failure = AppError::new(ErrorCode::Provider, "Rate limited.");
    failure.diagnostics = Some(serde_json::json!({"status":429,"request_id":"limited-request"}));
    record_retry(&db, "retrying", &failure).unwrap();
    associate(&db, "consumer", "retrying").unwrap();
    finish(
        &db,
        "retrying",
        "key",
        &serde_json::json!({"costMicros":null}),
        Some(b"audio"),
        None,
    )
    .unwrap();
    let receipt = receipt_for_consumer(&db, "consumer").unwrap().unwrap();
    assert!(
        receipt["response"]
            .get("costMicros")
            .is_some_and(serde_json::Value::is_null)
    );
    assert!(
        receipt["response"]["retry"]
            .to_string()
            .contains("limited-request")
    );
}

#[test]
fn speech_identity_preserves_exact_inputs_and_effective_access_scope() {
    use crate::ai::{audio::SpeechInput, connections::access::ResolvedTarget};
    use crate::model::ConnectionRoute;
    let target = ResolvedTarget {
        route: ConnectionRoute::Custom,
        revision: 1,
        url: "http://localhost/v1/audio/speech".into(),
        model: "speech-model".into(),
        credential: Some("account-one".into()),
    };
    let scope = speech::scope(&target, "workspace").unwrap();
    let input = SpeechInput {
        text: "\u{00e9}".into(),
        language: "fr".into(),
        voice: "unused".into(),
    };
    let key = speech::request_key(&scope, &input, "profile-one").unwrap();
    let mut changed = input.clone();
    for text in [
        "e\u{0301}",
        "\u{00e9} ",
        "\u{0643}\u{062a}\u{0627}\u{0628}",
        "\u{4e66}",
    ] {
        changed.text = text.into();
        assert_ne!(
            key,
            speech::request_key(&scope, &changed, "profile-one").unwrap()
        );
    }
    changed = input.clone();
    changed.voice = "different-unused-voice".into();
    assert_eq!(
        key,
        speech::request_key(&scope, &changed, "profile-one").unwrap()
    );
    changed.language = "other-language-tag".into();
    assert_ne!(
        key,
        speech::request_key(&scope, &changed, "profile-one").unwrap()
    );
    assert_ne!(
        key,
        speech::request_key(&scope, &input, "profile-two").unwrap()
    );
    let mut changed_target = target.clone();
    changed_target.revision += 1;
    assert_eq!(scope, speech::scope(&changed_target, "workspace").unwrap());
    changed_target.model = "other-model".into();
    assert_ne!(scope, speech::scope(&changed_target, "workspace").unwrap());
    changed_target = target.clone();
    changed_target.credential = Some("account-two".into());
    assert_ne!(scope, speech::scope(&changed_target, "workspace").unwrap());
    changed_target = target.clone();
    changed_target.url = "http://localhost/other/audio/speech".into();
    assert_ne!(scope, speech::scope(&changed_target, "workspace").unwrap());
    assert_ne!(scope, speech::scope(&target, "other-workspace").unwrap());
    let db = Connection::open_in_memory().unwrap();
    initialize(&db).unwrap();
    complete(&db, "old-profile", &key, b"old audio");
    remember_profile(&db, &scope, "profile-one").unwrap();
    assert!(
        speech::lookup(&db, &target, &input, "workspace")
            .unwrap()
            .is_some()
    );
    remember_profile(&db, &scope, "profile-two").unwrap();
    assert!(
        speech::lookup(&db, &target, &input, "workspace")
            .unwrap()
            .is_none()
    );
    // Existing associations still reference the original result after configuration changes.
    assert_eq!(
        read(&db, "old-profile").unwrap().unwrap().payload,
        b"old audio"
    );
}
