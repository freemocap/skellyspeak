use super::*;
use crate::drill::{DrillItemInput, owner};
fn item(store: &mut Store, language: &str) -> String {
    store
        .create_drill_item(DrillItemInput {
            text: "Hola".into(),
            language: language.into(),
            variety: None,
            explanation: "english".into(),
            explanation_variety: None,
        })
        .unwrap()
        .id
}
#[test]
fn returning_to_an_item_starts_a_new_visit_and_late_results_count_in_the_original() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = Store::open(&dir.path().join("practice.sqlite3")).unwrap();
    let a = item(&mut store, "spanish");
    let b = item(&mut store, "spanish");
    let session = store.start_drill_session("spanish").unwrap();
    let original = store.enter_drill_visit(&session, &a).unwrap();
    let captured = active_visit(&store.connection, &a).unwrap();
    store.enter_drill_visit(&session, &b).unwrap();
    let latest = store.enter_drill_visit(&session, &a).unwrap();
    assert_ne!(original, latest);
    store
        .connection
        .execute(
            "UPDATE ai_config SET route='hosted',hosted_credential_id='audio-reference'",
            [],
        )
        .unwrap();
    store
        .set_hosted_connection(1, Some("chat-reference"), "fixture@example.invalid")
        .unwrap();
    let target = crate::ai::connections::access::resolve(
        &store.connection,
        crate::ai::connections::access::Capability::Transcription,
    )
    .unwrap();
    store
        .begin_transcription_in_visit("late", &owner(&a), &target, Some(&captured))
        .unwrap();
    store
        .publish_transcription(
            "late",
            &owner(&a),
            &target,
            Ok("Hola".into()),
            None,
            Some(b"RIFF"),
        )
        .unwrap();
    let sessions = store.drill_sessions("spanish").unwrap();
    assert_eq!(sessions[0].visits.len(), 3);
    assert_eq!(sessions[0].visits[0].exact_matches, 1);
    assert_eq!(sessions[0].visits[2].exact_matches, 0);
    assert_eq!(sessions[0].visits[0].attempts, 1);
    assert_eq!(
        store
            .drill_items("spanish")
            .unwrap()
            .iter()
            .find(|i| i.id == a)
            .unwrap()
            .attempts[0]
            .visit_id
            .as_deref(),
        Some(original.as_str())
    );
    store.end_drill_session(&session).unwrap();
    assert!(active_visit(&store.connection, &a).is_err());
    assert!(store.enter_drill_visit(&session, &a).is_err());
}
#[test]
fn a_visit_cannot_cross_languages_or_claim_another_items_recording() {
    let dir = tempfile::tempdir().unwrap();
    let mut store = Store::open(&dir.path().join("practice.sqlite3")).unwrap();
    let a = item(&mut store, "spanish");
    let b = item(&mut store, "french");
    let session = store.start_drill_session("spanish").unwrap();
    assert!(store.enter_drill_visit(&session, &b).is_err());
    let visit = store.enter_drill_visit(&session, &a).unwrap();
    store
        .connection
        .execute(
            "UPDATE ai_config SET route='hosted',hosted_credential_id='audio-reference'",
            [],
        )
        .unwrap();
    store
        .set_hosted_connection(1, Some("chat-reference"), "fixture@example.invalid")
        .unwrap();
    let target = crate::ai::connections::access::resolve(
        &store.connection,
        crate::ai::connections::access::Capability::Transcription,
    )
    .unwrap();
    assert!(
        store
            .begin_transcription_in_visit("wrong", &owner(&b), &target, Some(&visit))
            .is_err()
    );
    assert_eq!(
        store
            .connection
            .query_row(
                "SELECT COUNT(*) FROM transcription_attempts WHERE id='wrong'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
        0
    );
}
#[test]
fn closing_an_old_session_does_not_close_its_replacement_and_restart_marks_interruption() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("practice.sqlite3");
    let mut store = Store::open(&path).unwrap();
    let a = item(&mut store, "spanish");
    let old = store.start_drill_session("spanish").unwrap();
    store.enter_drill_visit(&old, &a).unwrap();
    let current = store.start_drill_session("spanish").unwrap();
    let visit = store.enter_drill_visit(&current, &a).unwrap();
    store.end_drill_session(&old).unwrap();
    assert_eq!(active_visit(&store.connection, &a).unwrap(), visit);
    drop(store);
    let store = Store::open(&path).unwrap();
    let sessions = store.drill_sessions("spanish").unwrap();
    assert_eq!(sessions[0].end_reason.as_deref(), Some("interrupted"));
    assert!(sessions[0].visits[0].left_at.is_some());
    assert_eq!(sessions[1].end_reason.as_deref(), Some("replaced"));
    assert!(active_visit(&store.connection, &a).is_err());
}
