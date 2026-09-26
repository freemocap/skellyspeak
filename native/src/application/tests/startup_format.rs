use super::*;

#[test]
fn incompatible_stored_json_is_refused_before_product_reads_and_exposes_reset() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("workspace.sqlite3");
    let store = Store::open(&path).unwrap();
    // Even valid JSON must not be loaded under an incompatible workspace contract.
    store
        .connection
        .execute("UPDATE learner SET preferences='{}'", [])
        .unwrap();
    store
        .connection
        .pragma_update(None, "user_version", 40)
        .unwrap();
    drop(store);

    let app = Application::start(&path, None);
    let refusal = app.startup_state().refusal.unwrap();
    assert_eq!(refusal.code, ErrorCode::Storage);
    assert!(refusal.message.contains("incompatible data format (40)"));
    assert!(refusal.message.contains("Factory Reset"));
    assert!(!refusal.message.contains("JSON"));
    assert!(app.store.lock().unwrap().is_none());
    assert!(app.lock().is_err());
}
