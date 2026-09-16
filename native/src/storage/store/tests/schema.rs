use super::*;

#[test]
fn an_empty_workspace_opens_at_the_one_supported_version() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("skellyspeak.sqlite3");
    let store = Store::open(&path).unwrap();
    assert_eq!(
        store
            .connection
            .pragma_query_value(None, "user_version", |r| r.get::<_, i32>(0))
            .unwrap(),
        SCHEMA_VERSION
    );
    assert!(store.snapshot().is_ok());
    drop(store);
    // Reopening the same file is the ordinary path, not an upgrade.
    assert!(Store::open(&path).is_ok());
}

#[test]
fn any_other_schema_version_is_refused_without_modifying_the_file() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("skellyspeak.sqlite3");
    drop(Store::open(&path).unwrap());
    for version in [3, 5, 8, 9, 10, 11, 12, 13, 14, 15, 16, SCHEMA_VERSION + 1] {
        let connection = Connection::open(&path).unwrap();
        connection
            .pragma_update(None, "user_version", version)
            .unwrap();
        let before: i32 = connection
            .query_row("SELECT revision FROM metadata WHERE singleton=1", [], |r| {
                r.get(0)
            })
            .unwrap();
        drop(connection);
        let error = match Store::open(&path) {
            Ok(_) => panic!("version {version} must be refused"),
            Err(error) => error,
        };
        assert_eq!(error.code, ErrorCode::Storage);
        assert!(error.message.contains("Factory Reset"), "{}", error.message);
        let connection = Connection::open(&path).unwrap();
        assert_eq!(
            connection
                .pragma_query_value(None, "user_version", |r| r.get::<_, i32>(0))
                .unwrap(),
            version
        );
        assert_eq!(
            connection
                .query_row("SELECT revision FROM metadata WHERE singleton=1", [], |r| r
                    .get::<_, i32>(0))
                .unwrap(),
            before
        );
    }
}

#[test]
fn generation_receipt_schema_enforces_identity_state_and_nonnegative_usage() {
    let directory = tempfile::tempdir().unwrap();
    let store = Store::open(&directory.path().join("workspace.sqlite3")).unwrap();
    let insert = "INSERT INTO persona_generation_attempts(id,attempt_id,operation_id,language_id,route,requested_model,profile_revision,state,input_tokens,output_tokens) VALUES(?1,?2,?3,'es','custom','fixture',1,?4,?5,?6)";
    store
        .connection
        .execute(
            insert,
            params![
                "valid",
                "attempt",
                "operation",
                "pending",
                None::<i64>,
                None::<i64>
            ],
        )
        .unwrap();
    for (id, attempt, operation, state, input, output) in [
        ("other", "attempt", "other-operation", "pending", 0, 0),
        ("other", "other-attempt", "operation", "pending", 0, 0),
        (
            "other",
            "other-attempt",
            "other-operation",
            "invalid-state",
            0,
            0,
        ),
        (
            "other",
            "other-attempt",
            "other-operation",
            "succeeded",
            -1,
            0,
        ),
        (
            "other",
            "other-attempt",
            "other-operation",
            "succeeded",
            0,
            -1,
        ),
    ] {
        assert!(
            store
                .connection
                .execute(
                    insert,
                    params![id, attempt, operation, state, input, output]
                )
                .is_err()
        );
    }
}

#[test]
fn malformed_existing_database_is_not_reset() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("db");
    {
        let connection = Connection::open(&path).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE precious(value TEXT); INSERT INTO precious VALUES('keep');",
            )
            .unwrap();
    }
    assert!(Store::open(&path).is_err());
    let connection = Connection::open(&path).unwrap();
    let value: String = connection
        .query_row("SELECT value FROM precious", [], |r| r.get(0))
        .unwrap();
    assert_eq!(value, "keep");
}

#[test]
fn current_schema_damage_is_refused_without_resetting_data() {
    for damage in [
        "DROP TRIGGER revision_link_update;",
        "DROP TABLE credential_cleanup;",
        "ALTER TABLE turns ADD COLUMN unexpected TEXT;",
        "PRAGMA application_id=42;",
    ] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("workspace.sqlite3");
        let store = Store::open(&path).unwrap();
        store
            .connection
            .execute("UPDATE learner SET name='Retained sentinel'", [])
            .unwrap();
        store.connection.execute_batch(damage).unwrap();
        drop(store);
        assert!(Store::open(&path).is_err(), "{damage}");
        let db = Connection::open(&path).unwrap();
        assert_eq!(
            db.query_row("SELECT name FROM learner", [], |r| r.get::<_, String>(0))
                .unwrap(),
            "Retained sentinel"
        );
        assert_eq!(
            db.pragma_query_value(None, "user_version", |r| r.get::<_, i32>(0))
                .unwrap(),
            SCHEMA_VERSION
        );
    }
}
