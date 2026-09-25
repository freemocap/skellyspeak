//! One recording implementation, two owners: a conversation and a drill item.
use super::RecordingOwner;
use crate::ai::connections::access::ResolvedTarget;
use crate::model::*;
use crate::speech::recording::transcription::views;
use crate::storage::store::Store;
use rusqlite::params;

const ITEM_TEXT: &str = "Quisiera un café, por favor.";

fn setup() -> (
    tempfile::TempDir,
    Store,
    RecordingOwner,
    RecordingOwner,
    ResolvedTarget,
) {
    let dir = tempfile::tempdir().unwrap();
    let mut store = Store::open(&dir.path().join("owners.sqlite3")).unwrap();
    store.prepare_chat().unwrap();
    store
        .connection
        .execute("UPDATE ai_config SET route='hosted'", [])
        .unwrap();
    store
        .set_hosted_connection(1, Some("chat-reference"), "fixture@example.invalid")
        .unwrap();
    store
        .connection
        .execute(
            "UPDATE ai_config SET hosted_credential_id='audio-reference'",
            [],
        )
        .unwrap();
    let conversation = store.snapshot().unwrap().conversations[0].clone();
    store.connection.execute(
        "INSERT INTO drill_items(id,language_id,variety_id,explanation_language,explanation_variety_id,text) VALUES('item','spanish',?1,?2,?3,?4)",
        params![
            conversation.settings.variety_id,
            conversation.settings.explanation_language,
            conversation.settings.explanation_variety_id,
            ITEM_TEXT
        ],
    ).unwrap();
    let target = crate::ai::connections::access::resolve(
        &store.connection,
        crate::ai::connections::access::Capability::Transcription,
    )
    .unwrap();
    (
        dir,
        store,
        RecordingOwner::Conversation(conversation.id),
        RecordingOwner::DrillItem("item".into()),
        target,
    )
}

#[test]
fn a_drill_item_supplies_its_own_language_and_the_line_being_repeated() {
    let (_dir, store, conversation, item, _target) = setup();
    let drill = item.scope(&store).unwrap();
    let chat = conversation.scope(&store).unwrap();
    assert_eq!(drill.language.language_id, "spanish");
    assert_eq!(drill.language.language_tag, chat.language.language_tag);
    assert_eq!(drill.language.variety_id, chat.language.variety_id);
    // The recognizer is told what the learner is repeating.
    assert_eq!(drill.context.as_deref(), Some(ITEM_TEXT));
    // A conversation with no partner message yet has no context to offer.
    assert!(chat.context.is_none());
    // An owner that does not exist resolves to nothing at all.
    let unknown = RecordingOwner::DrillItem("missing".into());
    assert!(unknown.scope(&store).is_err());
    assert!(!unknown.available(&store.connection).unwrap());
}

#[test]
fn both_owners_record_through_the_same_receipts_and_stay_separate() {
    let (_dir, mut store, conversation, item, target) = setup();
    for owner in [&conversation, &item] {
        store
            .begin_transcription(owner.id(), owner, &target)
            .unwrap();
        assert_eq!(
            store
                .finish_transcription(owner.id(), owner, &target, Ok("Spoken words".into()))
                .unwrap(),
            "Spoken words"
        );
    }
    for owner in [&conversation, &item] {
        let receipts = views(&store.connection, owner).unwrap();
        assert_eq!(receipts.len(), 1);
        assert_eq!(receipts[0].id, owner.id());
        assert_eq!(receipts[0].state, "succeeded");
        assert_eq!(receipts[0].route, ConnectionRoute::Hosted);
        assert!(
            !serde_json::to_string(&receipts)
                .unwrap()
                .contains("Spoken words")
        );
    }
    // A receipt cannot be claimed or finished through the other owner.
    store
        .begin_transcription("crossed", &item, &target)
        .unwrap();
    assert!(
        store
            .finish_transcription("crossed", &conversation, &target, Ok("Late".into()))
            .is_err()
    );
    assert_eq!(views(&store.connection, &item).unwrap()[0].state, "running");
}

#[test]
fn drill_usage_counts_once_for_the_language_and_never_for_a_partner() {
    let (_dir, mut store, conversation, item, target) = setup();
    let before = store.profile().unwrap();
    for owner in [&conversation, &item] {
        store
            .begin_transcription(owner.id(), owner, &target)
            .unwrap();
        store
            .finish_transcription(owner.id(), owner, &target, Ok("Spoken words".into()))
            .unwrap();
    }
    let after = store.profile().unwrap();
    let language = |profile: &ProfileSnapshot| {
        profile
            .languages
            .iter()
            .find(|l| l.id == "spanish")
            .map(|l| (l.attempts, l.unknown_usage))
            .unwrap()
    };
    // Both recordings count once globally and once for their language; a
    // transcription's usage is never reported by the provider, so both stay
    // unknown usage rather than being counted as zero tokens.
    assert_eq!(after.global.attempts, before.global.attempts + 2);
    assert_eq!(after.global.unknown_usage, before.global.unknown_usage + 2);
    assert_eq!(language(&after).0, language(&before).0 + 2);
    assert_eq!(language(&after).1, language(&before).1 + 2);
    // The partner owns only its own conversation's recording.
    let partner = |profile: &ProfileSnapshot| profile.personas[0].attempts;
    assert_eq!(partner(&after), partner(&before) + 1);
    // Removing the item removes its receipt and its usage, and leaves the
    // conversation's untouched.
    store
        .connection
        .execute("DELETE FROM drill_items WHERE id='item'", [])
        .unwrap();
    let pruned = store.profile().unwrap();
    assert_eq!(pruned.global.attempts, before.global.attempts + 1);
    assert_eq!(partner(&pruned), partner(&before) + 1);
    assert!(views(&store.connection, &item).unwrap().is_empty());
    assert_eq!(
        views(&store.connection, &conversation).unwrap()[0].state,
        "succeeded"
    );
}

#[test]
fn an_archived_item_stops_publication_with_an_unknown_outcome() {
    let (_dir, mut store, _conversation, item, target) = setup();
    store
        .begin_transcription("recording", &item, &target)
        .unwrap();
    store
        .connection
        .execute("UPDATE drill_items SET archived=1", [])
        .unwrap();
    // The audio may already have cost money, so the outcome is unknown, not failed.
    assert_eq!(
        store
            .finish_transcription("recording", &item, &target, Ok("Late speech".into()))
            .unwrap_err()
            .code,
        ErrorCode::UnknownOutcome
    );
    assert_eq!(views(&store.connection, &item).unwrap()[0].state, "unknown");
    // An archived item cannot start a new recording either.
    assert!(store.begin_transcription("second", &item, &target).is_err());
}

#[test]
fn irish_drill_captures_scribe_in_the_shared_transcription_receipt() {
    let (_dir, store, _, drill, _) = setup();
    store
        .connection
        .execute(
            "UPDATE drill_items SET language_id='irish',variety_id='irish-ireland' WHERE id='item'",
            [],
        )
        .unwrap();
    let scope = drill.scope(&store).unwrap();
    let target = crate::ai::connections::speech_routing::resolve(
        &store.connection,
        crate::ai::connections::access::Capability::Transcription,
        &scope.language_context,
    )
    .unwrap();
    assert_eq!(target.model, "scribe_v2");
    assert_eq!(scope.language.language_tag, "ga");
    crate::speech::recording::transcription::begin(
        &store.connection,
        "irish-attempt",
        &drill,
        &target,
    )
    .unwrap();
    let saved: String = store
        .connection
        .query_row(
            "SELECT model FROM transcription_attempts WHERE id='irish-attempt'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(saved, "scribe_v2");
    let metadata = crate::diagnostics::response::metadata(
        &serde_json::json!({"routing": target.audio_resolution}),
        &[],
    );
    assert_eq!(metadata["routing"]["model"], "scribe_v2");
    assert_eq!(metadata["routing"]["requested_model"], "whisper-large-v3");
    assert_eq!(metadata["routing"]["reason"], "compatible_alternative");
}
