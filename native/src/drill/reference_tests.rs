use super::*;
use crate::{
    drill::DrillItemInput,
    language::reading::{ReadingInput, Registry},
};

fn setup() -> (tempfile::TempDir, Store) {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("reference.sqlite3")).unwrap();
    store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl','http://127.0.0.1:8765/v1','$.bearerAuth',json('false'))", []).unwrap();
    (dir, store)
}
fn request(store: &mut Store, text: &str) -> std::sync::Arc<Request> {
    let item = store
        .create_drill_item(DrillItemInput {
            text: text.into(),
            language: "spanish".into(),
            variety: None,
            explanation: "english".into(),
            explanation_variety: None,
        })
        .unwrap();
    let registry = Registry::default();
    let id = registry
        .begin(
            store,
            ReadingInput {
                reference_item: Some(item.id),
                text: text.into(),
                language: "spanish".into(),
                variety: None,
                explanation: "english".into(),
                explanation_variety: None,
                aid: ReadingAid::Speech,
            },
        )
        .unwrap();
    registry.claim(&id).unwrap()
}

#[test]
fn cache_is_source_scoped_and_invalidates_changed_generation_settings() {
    let (_dir, mut store) = setup();
    let original = request(&mut store, "Hola");
    put(&store, &original, b"audio").unwrap();
    store.set_drill_storage(0).unwrap();
    assert_eq!(store.drill_storage().unwrap().reference_bytes, 5);
    assert_eq!(get(&store, &original).unwrap().unwrap().0, b"audio");
    let other = request(&mut store, "Hola");
    assert!(get(&store, &other).unwrap().is_none());
    let mut changed = Request::capture(&store, original.input.clone()).unwrap();
    changed.target.model = "different-model".into();
    assert!(get(&store, &changed).unwrap().is_none());
    changed.target = original.target.clone();
    changed.config_hash = "different-config".into();
    assert!(get(&store, &changed).unwrap().is_none());
    let mut wrong = original.input.clone();
    wrong.text = "Adiós".into();
    assert!(Request::capture(&store, wrong).is_err());
    let mut wrong = original.input.clone();
    wrong.aid = ReadingAid::Translation;
    assert!(Request::capture(&store, wrong).is_err());
    store
        .delete_drill_item(original.input.reference_item.as_ref().unwrap())
        .unwrap();
    assert!(original.validate(&store).is_err());
    assert!(put(&store, &original, b"late audio").is_err());
    let count: i64 = store
        .connection
        .query_row("SELECT count(*) FROM drill_references", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 0);
}

#[test]
fn reference_budget_evicts_least_recent_media_but_keeps_receipts() {
    let (_dir, mut store) = setup();
    let audio = vec![1; crate::speech::cache::AUDIO_LIMIT];
    let requests: Vec<_> = (0..5)
        .map(|n| request(&mut store, &format!("Hola {n}")))
        .collect();
    for request in &requests[..4] {
        put(&store, request, &audio).unwrap();
    }
    assert!(get(&store, &requests[0]).unwrap().is_some());
    put(&store, &requests[4], &audio).unwrap();
    assert!(get(&store, &requests[1]).unwrap().is_none());
    assert!(get(&store, &requests[0]).unwrap().is_some());
    assert!(put(&store, &requests[0], &[]).is_err());
    assert!(get(&store, &requests[0]).unwrap().is_some());
    let bytes: i64 = store
        .connection
        .query_row("SELECT SUM(length(audio)) FROM drill_references", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(bytes, BUDGET as i64);
    let receipts: i64 = store
        .connection
        .query_row("SELECT count(*) FROM reading_attempts", [], |r| r.get(0))
        .unwrap();
    assert_eq!(receipts, 5);
}
