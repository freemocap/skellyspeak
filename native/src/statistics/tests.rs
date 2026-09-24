use super::*;
use crate::ai::results;
use serde_json::json;

fn apply(store: &mut Store, action: Action) -> String {
    store
        .execute(Command {
            session_id: store.session_id.clone(),
            action_id: uuid::Uuid::new_v4().to_string(),
            action,
        })
        .unwrap()
        .entity_id
}

fn speech_consumer(store: &mut Store, consumer: &str) -> String {
    let conversation = apply(
        store,
        Action::CreateContact {
            language_id: "spanish".into(),
            details: crate::partners::persona::starter("spanish").unwrap(),
        },
    );
    let revision = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|row| row.id == conversation)
        .unwrap()
        .revision;
    apply(
        store,
        Action::SendMessage {
            conversation_id: conversation.clone(),
            text: "Hello".into(),
            input: crate::learning::coaching::InputEvidence::default(),
            expected_revision: revision,
        },
    );
    let turn: String = store
        .connection
        .query_row(
            "SELECT id FROM turns WHERE conversation_id=?1 ORDER BY rowid DESC LIMIT 1",
            [&conversation],
            |row| row.get(0),
        )
        .unwrap();
    let operation: String = store.connection.query_row(
        "UPDATE operations SET state='succeeded' WHERE turn_id=?1 AND kind='persona_speech' RETURNING id",
        [&turn], |row| row.get(0),
    ).unwrap();
    store.connection.execute(
        "INSERT INTO attempts(id,operation_id,state,requested_model) VALUES(?1,?2,'succeeded','speech-fixture')",
        params![consumer, operation],
    ).unwrap();
    store.connection.query_row(
        "SELECT r.persona_id FROM conversations c JOIN contacts r ON r.id=c.contact_id WHERE c.id=?1",
        [&conversation], |row| row.get(0),
    ).unwrap()
}

#[test]
fn shared_speech_counts_once_per_scope_and_survives_payload_eviction() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("usage.sqlite3");
    let mut store = Store::open(&path).unwrap();
    store
        .set_hosted_connection(1, Some("fixture-credential"), "fixture@example.invalid")
        .unwrap();
    let first = speech_consumer(&mut store, "first");
    let second = speech_consumer(&mut store, "second");
    assert_ne!(first, second);
    let db = &store.connection;
    results::begin(db, "shared", "speech").unwrap();
    results::dispatched(db, "shared").unwrap();
    results::finish(
        db,
        "shared",
        "key",
        &json!({
            "inputTokens":7,"outputTokens":11,"costMicros":null,"providerId":"retained-id"
        }),
        Some(b"fixture audio"),
        None,
    )
    .unwrap();
    for consumer in ["first", "second", "reading", "reading-again"] {
        results::associate(db, consumer, "shared").unwrap();
    }
    for id in ["reading", "reading-again"] {
        db.execute(
            "INSERT INTO reading_attempts(id,receipt) VALUES(?1,?2)",
            params![
                id,
                json!({"id":id,"language":"spanish","state":"succeeded"}).to_string()
            ],
        )
        .unwrap();
    }
    // A profile-discovery failure is not a dispatched synthesis execution.
    results::begin(db, "unsubmitted", "speech").unwrap();
    results::finish(
        db,
        "unsubmitted",
        "other-key",
        &json!({}),
        None,
        Some(&AppError::new(
            ErrorCode::Provider,
            "Configuration unavailable.",
        )),
    )
    .unwrap();
    for _ in 0..2 {
        let profile = store.profile().unwrap();
        assert_eq!(
            (
                profile.global.attempts,
                profile.global.input_tokens,
                profile.global.output_tokens,
                profile.global.unknown_usage
            ),
            (1, 7, 11, 0)
        );
        let spanish = profile
            .languages
            .iter()
            .find(|row| row.id == "spanish")
            .unwrap();
        assert_eq!((spanish.attempts, spanish.input_tokens), (1, 7));
        assert!(
            profile
                .languages
                .iter()
                .filter(|row| row.id != "spanish")
                .all(|row| row.attempts == 0)
        );
        for id in [&first, &second] {
            let partner = profile.personas.iter().find(|row| &row.id == id).unwrap();
            assert_eq!(
                (
                    partner.attempts,
                    partner.input_tokens,
                    partner.output_tokens
                ),
                (1, 7, 11)
            );
        }
        assert_eq!(
            profile.personas.iter().map(|row| row.attempts).sum::<i32>(),
            2
        );
        results::set_capacity(db, 0).unwrap();
    }
    drop(store);
    let reopened = Store::open(&path).unwrap();
    assert_eq!(reopened.profile().unwrap().global.attempts, 1);
    assert!(
        results::for_consumer(&reopened.connection, "reading")
            .unwrap()
            .is_none()
    );
    let receipt = results::receipt_for_consumer(&reopened.connection, "reading")
        .unwrap()
        .unwrap();
    assert_eq!(receipt["response"]["providerId"], "retained-id");
    assert!(receipt["response"]["costMicros"].is_null());
}
