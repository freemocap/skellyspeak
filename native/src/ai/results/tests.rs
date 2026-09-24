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
