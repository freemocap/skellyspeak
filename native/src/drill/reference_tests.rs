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
fn publication_requires_the_captured_phrase_and_live_owner() {
    let (_dir, mut store) = setup();
    let original = request(&mut store, "Hola");
    let mut wrong = original.input.clone();
    wrong.text = "different source".into();
    assert!(Request::capture(&store, wrong).is_err());
    let mut wrong = original.input.clone();
    wrong.aid = ReadingAid::Translation;
    assert!(Request::capture(&store, wrong).is_err());
    store
        .delete_drill_item(original.input.reference_item.as_ref().unwrap())
        .unwrap();
    assert!(original.validate_source(&store).is_err());
}
