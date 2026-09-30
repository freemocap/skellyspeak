use super::*;

#[tokio::test]
async fn custom_server_refusal_redacts_remote_content_before_persistence() {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    for request_id in ["1234567890abcdef1234567890abcdef", "private-header-token"] {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut input = Vec::new();
            loop {
                let mut chunk = [0u8; 4096];
                let count = socket.read(&mut chunk).await.unwrap();
                assert!(count > 0);
                input.extend_from_slice(&chunk[..count]);
                if let Some(start) = input.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&input[..start]);
                    let length: usize = headers
                        .lines()
                        .find_map(|line| {
                            line.to_ascii_lowercase()
                                .strip_prefix("content-length: ")
                                .map(str::to_owned)
                        })
                        .unwrap()
                        .parse()
                        .unwrap();
                    if input.len() >= start + 4 + length {
                        break;
                    }
                }
            }
            let body = r#"{"detail":"Invalid request: authorization=private-authorization-secret; content=private-echoed-message","code":"INVALID_REQUEST","request_id":"private-body-token"}"#;
            let response = format!(
                "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nX-Request-ID: {request_id}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            socket.write_all(response.as_bytes()).await.unwrap();
        });
        let (dir, mut store, conversation) = setup();
        store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl',?1,'$.bearerAuth',json('false'))", [&url]).unwrap();
        let dispatch = begin(&mut store, &conversation);
        assert_eq!(dispatch.route, ConnectionRoute::Custom);
        let error = crate::ai::transport::grouped::complete(
            &crate::ai::transport::provider::client().unwrap(),
            "",
            &dispatch.text_request(),
        )
        .await
        .unwrap_err();
        server.await.unwrap();
        assert!(error.message.contains("HTTP 400"));
        assert!(error.message.contains("Invalid request"));
        assert!(!error.message.contains("private"));
        assert!(
            !serde_json::to_string(&error.diagnostics)
                .unwrap()
                .contains("private")
        );
        assert_eq!(
            error.message.contains("Request ID:"),
            request_id.len() == 32
        );
        let message = error.message.clone();
        store.finish(&dispatch, Err(error)).unwrap();
        drop(store);
        let reopened = Store::open(&dir.path().join("test.sqlite3")).unwrap();
        let persisted: String = reopened
            .connection
            .query_row(
                "SELECT error FROM attempts WHERE id=?1",
                [&dispatch.attempt],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(persisted, message);
        let context: String = reopened
            .connection
            .query_row(
                "SELECT context FROM turns WHERE id=(SELECT turn_id FROM operations WHERE id=?1)",
                [&dispatch.operation],
                |row| row.get(0),
            )
            .unwrap();
        for sentinel in [
            "private-authorization-secret",
            "private-echoed-message",
            "private-body-token",
            "private-header-token",
        ] {
            assert!(!context.contains(sentinel));
        }
    }
}

#[test]
fn refusal_holds_matching_queue_without_attempts_and_survives_restart() {
    let (dir, mut store, first) = setup();
    let contact_id = store.snapshot().unwrap().contacts[0].id.clone();
    let second = apply(
        &mut store,
        Action::CreateConversation {
            contact_id: contact_id.clone(),
            title: "Queued".into(),
        },
    )
    .entity_id;
    let third = apply(
        &mut store,
        Action::CreateConversation {
            contact_id,
            title: "Independent".into(),
        },
    )
    .entity_id;
    let dispatch = begin(&mut store, &first);
    let command = send(&store, &second);
    let queued = store.execute(command).unwrap().entity_id;
    let command = send(&store, &third);
    let independent = store.execute(command).unwrap().entity_id;
    // A separately captured credential must not inherit another key's hold.
    store.connection.execute("UPDATE turns SET context=json_set(context,'$.target.credential','separate-key') WHERE id=?1", [&independent]).unwrap();
    let error = AppError::new(ErrorCode::Provider, "Provider refused this request.")
        .with_refusal(crate::ai::policy::refusal::classify(None, Some(60), None));
    store.finish(&dispatch, Err(error)).unwrap();
    let view = store.conversation_snapshot(&second, None).unwrap();
    assert!(view.turns[0].paused);
    assert!(view.turns[0].hold.is_some());
    assert!(view.turns[0].attempts.is_empty());
    assert!(!store.conversation_snapshot(&third, None).unwrap().turns[0].paused);
    assert!(control_turn(&store.connection, &queued, TurnControl::Step).is_err());
    // No failed-queue entry consumes an invented network attempt.
    assert!(store.dispatch().unwrap().is_none()); // Independent local context.
    assert!(store.dispatch().unwrap().is_some()); // Independent network work.
    drop(store);
    let mut reopened = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    reopened.prepare_chat().unwrap();
    let view = reopened.conversation_snapshot(&second, None).unwrap();
    assert!(view.turns[0].hold.is_some());
    assert!(reopened.dispatch().unwrap().is_none());
    // Explicit resume reaches the server even before the original retry time.
    control_turn(&reopened.connection, &queued, TurnControl::Resume).unwrap();
    assert!(
        reopened.conversation_snapshot(&second, None).unwrap().turns[0]
            .hold
            .is_none()
    );
    assert!(reopened.dispatch().unwrap().is_none());
    assert!(reopened.dispatch().unwrap().is_some());
}

#[test]
fn audio_refusal_does_not_block_new_chat_or_survive_as_an_access_lockout() {
    let (dir, mut store, conversation) = setup();
    store
        .connection
        .execute(
            "UPDATE ai_config SET route='hosted',hosted_credential_id='hosted-test'",
            [],
        )
        .unwrap();
    let target = crate::ai::connections::access::resolve(
        &store.connection,
        crate::ai::connections::access::Capability::Chat,
    )
    .unwrap();
    let error = AppError::new(ErrorCode::Provider, "Daily request limit reached.").with_refusal(
        crate::ai::policy::refusal::classify(Some("PERSONAL_ACCOUNT_DAILY_LIMIT"), None, None),
    );
    store.note_refusal(&target, &error).unwrap();
    // Simulate the version-45 table; retirement now belongs to its migration.
    store
        .connection
        .execute_batch("DROP TABLE skill_level_events; CREATE TABLE inference_holds(id TEXT PRIMARY KEY, error TEXT NOT NULL); PRAGMA user_version=45;")
        .unwrap();
    store
        .connection
        .execute(
            "INSERT INTO inference_holds VALUES('hosted-service',?1)",
            [serde_json::to_string(&error).unwrap()],
        )
        .unwrap();
    drop(store);
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    store.prepare_chat().unwrap();
    assert!(
        !store
            .connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='inference_holds')",
                [],
                |row| row.get::<_, bool>(0),
            )
            .unwrap()
    );
    let command = send(&store, &conversation);
    store.execute(command).unwrap();
    assert!(
        !store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .is_empty()
    );
}

#[test]
fn manual_retry_before_daily_reset_preserves_error_and_repauses_on_new_refusal() {
    let (dir, mut store, conversation) = setup();
    let dispatch = begin(&mut store, &conversation);
    let turn = store
        .conversation_snapshot(&conversation, None)
        .unwrap()
        .turns[0]
        .id
        .clone();
    let error = AppError::new(ErrorCode::Provider, "Daily request limit reached.")
        .with_refusal(crate::ai::policy::refusal::classify(
            Some("PERSONAL_ACCOUNT_DAILY_LIMIT"),
            None,
            Some("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        ))
        .with_diagnostics(serde_json::json!({"code":"PERSONAL_ACCOUNT_DAILY_LIMIT"}));
    assert!(error.refusal.as_ref().unwrap().retry_at.unwrap() > crate::ai::policy::refusal::now());
    store.finish(&dispatch, Err(error.clone())).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    drop(store);
    let mut store = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    store.prepare_chat().unwrap();
    assert!(store.dispatch().unwrap().is_none());
    apply(
        &mut store,
        Action::ControlTurn {
            turn_id: turn.clone(),
            control: TurnControl::Retry,
        },
    );
    let retry = store.dispatch().unwrap().unwrap();
    assert_ne!(retry.attempt, dispatch.attempt);
    let snapshot = store.conversation_snapshot(&conversation, None).unwrap();
    let original = snapshot.turns[0]
        .attempts
        .iter()
        .find(|a| a.id == dispatch.attempt)
        .unwrap();
    assert_eq!(original.error.as_deref(), Some(error.message.as_str()));
    assert!(
        serde_json::to_string(&original.diagnostics)
            .unwrap()
            .contains("PERSONAL_ACCOUNT_DAILY_LIMIT")
    );
    store.finish(&retry, Err(error)).unwrap();
    assert!(store.dispatch().unwrap().is_none());
    assert!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .turns[0]
            .hold
            .is_some()
    );
}

#[test]
fn service_refusal_spans_hosted_targets_but_not_custom_servers() {
    let (_dir, mut store, first) = setup();
    store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl','https://custom.example/v1','$.bearerAuth',json('false'))", []).unwrap();
    let dispatch = begin(&mut store, &first);
    let contact_id = store.snapshot().unwrap().contacts[0].id.clone();
    let hosted = apply(
        &mut store,
        Action::CreateConversation {
            contact_id,
            title: "Hosted".into(),
        },
    )
    .entity_id;
    let command = send(&store, &hosted);
    let turn = store.execute(command).unwrap().entity_id;
    store
        .connection
        .execute(
            "UPDATE turns SET context=json_set(context,'$.target.route','hosted') WHERE id=?1",
            [&turn],
        )
        .unwrap();
    let mut target = dispatch.target;
    target.route = ConnectionRoute::Hosted;
    target.url = "https://service.example/v1/audio/transcriptions".into();
    let error = AppError::new(ErrorCode::Provider, "Daily allowance exhausted.").with_refusal(
        crate::ai::policy::refusal::classify(Some("SHARED_ALLOWANCE_EXHAUSTED"), None, None),
    );
    pause_related(&store.connection, &target, &error).unwrap();
    assert!(
        store.conversation_snapshot(&hosted, None).unwrap().turns[0]
            .hold
            .is_some()
    );
    assert!(
        store.conversation_snapshot(&first, None).unwrap().turns[0]
            .hold
            .is_none()
    );
    // An ordinary transport failure does not hold unrelated queued work.
    pause_related(
        &store.connection,
        &target,
        &AppError::new(ErrorCode::Provider, "HTTP 500"),
    )
    .unwrap();
    assert!(
        store.conversation_snapshot(&first, None).unwrap().turns[0]
            .hold
            .is_none()
    );
}
