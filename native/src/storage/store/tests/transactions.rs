use super::*;

#[test]
fn handler_failure_after_turn_creation_rolls_back_and_leaves_action_retryable() {
    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(&directory.path().join("db")).unwrap();
    store
        .set_connection(
            1,
            Some("test-credential"),
            "google/gemini-2.5-flash",
            "google/gemini-2.5-flash-lite",
        )
        .unwrap();
    store
        .select_route(
            store.connection_config().unwrap().revision,
            ConnectionRoute::Openrouter,
        )
        .unwrap();
    let config = store.connection_config().unwrap();
    let audio = config.audio.clone();
    store
        .set_models(
            config.revision,
            &config.standard_model,
            &config.fast_model,
            &audio,
            AssessmentAdapter::ChatModel,
        )
        .unwrap();
    let contact = contact(&mut store);
    let conversation = conversation(&mut store, &contact, "Rollback test");
    let before = serde_json::to_value(store.snapshot().unwrap()).unwrap();
    let mut cmd = command(
        &store,
        Action::SendMessage {
            input: crate::learning::coaching::InputEvidence {
                modality: "invalid-modality".into(),
                ..Default::default()
            },
            conversation_id: conversation.id.clone(),
            text: "Hola".into(),
            expected_revision: conversation.revision,
        },
    );

    // The handler admits and inserts a turn before checking input modality.
    // A handler error must roll back those writes and the command envelope.
    let error = store.execute(cmd.clone()).unwrap_err();
    assert_eq!(error.code, ErrorCode::Validation);
    assert_eq!(error.message, "Invalid input modality.");
    assert_eq!(
        serde_json::to_value(store.snapshot().unwrap()).unwrap(),
        before
    );
    for table in ["turns", "messages", "operations", "attempts"] {
        let count: i64 = store
            .connection
            .query_row(&format!("SELECT count(*) FROM {table}"), [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(count, 0, "failed handler left rows in {table}");
    }
    let receipt_count: i64 = store
        .connection
        .query_row(
            "SELECT count(*) FROM receipts WHERE action_id=?1",
            [&cmd.action_id],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(receipt_count, 0);

    if let Action::SendMessage { input, .. } = &mut cmd.action {
        input.modality = "text".into();
    }
    let accepted = store.execute(cmd.clone()).unwrap();
    let replay = store.execute(cmd).unwrap();
    assert_eq!(accepted.entity_id, replay.entity_id);
    let count: i64 = store
        .connection
        .query_row("SELECT count(*) FROM turns", [], |row| row.get(0))
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn duplicate_commands_are_idempotent_and_reusing_identity_with_other_payload_fails() {
    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(&directory.path().join("db")).unwrap();
    let cmd = command(
        &store,
        Action::CreateContact {
            language_id: "spanish".into(),
            details: crate::partners::persona::starter("spanish").unwrap(),
        },
    );
    let first = store.execute(cmd.clone()).unwrap();
    let second = store.execute(cmd.clone()).unwrap();
    assert_eq!(first.entity_id, second.entity_id);
    assert_eq!(store.snapshot().unwrap().personas.len(), 1);
    let mut other = cmd;
    other.action = Action::CreateContact {
        language_id: "french".into(),
        details: crate::partners::persona::starter("french").unwrap(),
    };
    assert_eq!(store.execute(other).unwrap_err().code, ErrorCode::Conflict);
}

#[test]
fn stale_settings_and_invalid_language_do_not_partially_write() {
    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(&directory.path().join("db")).unwrap();
    let contact = contact(&mut store);
    let convo = conversation(&mut store, &contact, "Plans");
    let mut invalid = convo.settings.clone();
    invalid.variety_id = "french-france".into();
    let before = store.snapshot().unwrap().revision;
    let invalid_cmd = command(
        &store,
        Action::UpdateSettings {
            conversation_id: convo.id.clone(),
            expected_revision: 1,
            settings: invalid,
        },
    );
    assert_eq!(
        store.execute(invalid_cmd).unwrap_err().code,
        ErrorCode::Validation
    );
    assert_eq!(store.snapshot().unwrap().revision, before);
    apply(
        &mut store,
        Action::UpdateSettings {
            conversation_id: convo.id.clone(),
            expected_revision: 1,
            settings: convo.settings.clone(),
        },
    );
    let stale = command(
        &store,
        Action::UpdateSettings {
            conversation_id: convo.id,
            expected_revision: 1,
            settings: convo.settings,
        },
    );
    assert_eq!(store.execute(stale).unwrap_err().code, ErrorCode::Conflict);
}
