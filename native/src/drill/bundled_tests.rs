//! Preview must not create cards; acceptance is limited to explicitly selected authored IDs.
use super::*;
fn setup() -> (tempfile::TempDir, Store) {
    let dir = tempfile::tempdir().unwrap();
    let store = Store::open(&dir.path().join("practice.sqlite3")).unwrap();
    (dir, store)
}
fn scope(language: &str) -> ReadingScope {
    ReadingScope {
        language: language.into(),
        variety: None,
        explanation: "english".into(),
        explanation_variety: None,
    }
}
fn count(store: &Store, table: &str) -> i64 {
    store
        .connection
        .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
            row.get(0)
        })
        .unwrap()
}
#[test]
fn preview_does_not_save_and_only_selected_phrases_are_kept() {
    let (_dir, mut store) = setup();
    let preview = store
        .preview_practice_set(scope("spanish"), PracticeSet::Social)
        .unwrap();
    assert_eq!(preview.candidates.len(), 15);
    assert_eq!(count(&store, "drill_items"), 0);
    assert_eq!(count(&store, "drill_previews"), 0);
    let ids = vec![
        preview.candidates[2].candidate_id.clone(),
        preview.candidates[5].candidate_id.clone(),
    ];
    let kept = store
        .accept_practice_phrases(
            scope("spanish"),
            PracticeSet::Social,
            &preview.request_id,
            ids.clone(),
        )
        .unwrap();
    assert_eq!(
        kept.iter()
            .map(|item| item.text.as_str())
            .collect::<Vec<_>>(),
        vec![
            preview.candidates[2].text.as_str(),
            preview.candidates[5].text.as_str()
        ]
    );
    assert!(kept.iter().all(|item| matches!(
        item.source,
        DrillSource::Bundled {
            set: PracticeSet::Social,
            ..
        }
    )));
    let again = store
        .accept_practice_phrases(
            scope("spanish"),
            PracticeSet::Social,
            &preview.request_id,
            ids,
        )
        .unwrap();
    assert_eq!(again[0].id, kept[0].id);
    assert_eq!(count(&store, "drill_items"), 2);
    assert_eq!(count(&store, "generation_attempts"), 0);
    let refreshed = store
        .preview_practice_set(scope("spanish"), PracticeSet::Social)
        .unwrap();
    assert!(refreshed.candidates[2].verified.duplicate);
    assert!(!refreshed.candidates[0].verified.duplicate);
}
#[test]
fn rejects_stale_foreign_and_empty_selections_and_rolls_back_failure() {
    let (_dir, mut store) = setup();
    let preview = store
        .preview_practice_set(scope("spanish"), PracticeSet::Beginner)
        .unwrap();
    let ids = preview
        .candidates
        .iter()
        .take(2)
        .map(|candidate| candidate.candidate_id.clone())
        .collect::<Vec<_>>();
    assert!(
        store
            .accept_practice_phrases(
                scope("spanish"),
                PracticeSet::Beginner,
                "stale",
                ids.clone()
            )
            .is_err()
    );
    assert!(
        store
            .accept_practice_phrases(
                scope("spanish"),
                PracticeSet::Social,
                &preview.request_id,
                ids.clone()
            )
            .is_err()
    );
    assert!(
        store
            .accept_practice_phrases(
                scope("spanish"),
                PracticeSet::Beginner,
                &preview.request_id,
                vec![]
            )
            .is_err()
    );
    assert!(
        store
            .accept_practice_phrases(
                scope("spanish"),
                PracticeSet::Beginner,
                &preview.request_id,
                vec!["invented".into()]
            )
            .is_err()
    );
    store.connection.execute_batch("CREATE TEMP TRIGGER fail_second_practice BEFORE INSERT ON drill_items WHEN (SELECT COUNT(*) FROM drill_items) = 1 BEGIN SELECT RAISE(ABORT, 'test insertion failure'); END;").unwrap();
    assert!(
        store
            .accept_practice_phrases(
                scope("spanish"),
                PracticeSet::Beginner,
                &preview.request_id,
                ids
            )
            .is_err()
    );
    assert_eq!(count(&store, "drill_items"), 0);
}
#[test]
fn previews_preserve_scripts_and_selected_variety_without_writes() {
    let (_dir, store) = setup();
    for language in [
        "arabic",
        "mandarin",
        "hindi",
        "malayalam",
        "irish",
        "ukrainian",
    ] {
        let preview = store
            .preview_practice_set(scope(language), PracticeSet::Idiomatic)
            .unwrap();
        assert_eq!(
            preview
                .candidates
                .iter()
                .map(|candidate| candidate.text.clone())
                .collect::<Vec<_>>(),
            store
                .config
                .practice_phrases(language, None)
                .unwrap()
                .idiomatic
        );
    }
    let mut standard = scope("arabic");
    standard.variety = Some("arabic-modern-standard".into());
    assert_eq!(
        store
            .preview_practice_set(standard, PracticeSet::Idiomatic)
            .unwrap()
            .candidates[0]
            .text,
        "تجري الرياح بما لا تشتهي السفن."
    );
    assert_eq!(count(&store, "drill_items"), 0);
}
