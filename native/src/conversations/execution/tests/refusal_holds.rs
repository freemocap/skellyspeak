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
            &dispatch,
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
    assert!(control_turn(&store.connection, &queued, TurnControl::Resume).is_err());
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
    // Expiry alone does not resume the queue; explicit recovery is required.
    reopened.connection.execute("UPDATE turns SET refusal_hold=json_set(refusal_hold,'$.refusal.retryAt',0) WHERE id=?1", [&queued]).unwrap();
    assert!(reopened.dispatch().unwrap().is_none());
    assert!(control_turn(&reopened.connection, &queued, TurnControl::Resume).is_err());
    reopened
        .connection
        .execute(
            "UPDATE inference_holds SET error=json_set(error,'$.refusal.retryAt',0)",
            [],
        )
        .unwrap();
    let hold = crate::ai::policy::holds::views(&reopened.connection)
        .unwrap()
        .remove(0);
    apply(
        &mut reopened,
        Action::RecoverAiAccess {
            hold_id: hold.id,
            expected_generation: hold.generation,
        },
    );
    assert!(reopened.dispatch().unwrap().is_none());
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
fn audio_refusal_blocks_new_chat_before_acceptance_and_survives_source_deletion() {
    let (dir, mut store, conversation) = setup();
    let mut target = crate::ai::connections::access::resolve(
        &store.connection,
        crate::ai::connections::access::Capability::Chat,
    )
    .unwrap();
    // Hosted audio and chat share the service spending boundary.
    store
        .connection
        .execute(
            "UPDATE ai_config SET route='hosted',hosted_credential_id='hosted-test'",
            [],
        )
        .unwrap();
    target.route = ConnectionRoute::Hosted;
    target.url = format!("{}/v1/audio/transcriptions", crate::ai::hosted::ORIGIN);
    target.credential = Some("hosted-test".into());
    store
        .note_refusal(
            &target,
            &AppError::new(ErrorCode::Provider, "Spending paused.").with_refusal(
                crate::ai::policy::refusal::classify(Some("SPENDING_PAUSED"), None, None),
            ),
        )
        .unwrap();
    let command = send(&store, &conversation);
    assert_eq!(
        store.execute(command).unwrap_err().code,
        ErrorCode::AdmissionHeld
    );
    assert!(
        store
            .conversation_snapshot(&conversation, None)
            .unwrap()
            .messages
            .is_empty()
    );
    let revision = store
        .snapshot()
        .unwrap()
        .conversations
        .iter()
        .find(|c| c.id == conversation)
        .unwrap()
        .revision;
    apply(
        &mut store,
        Action::DeleteConversation {
            conversation_id: conversation,
            expected_revision: revision,
        },
    );
    drop(store);
    let reopened = Store::open(&dir.path().join("test.sqlite3")).unwrap();
    assert_eq!(
        crate::ai::policy::holds::check(&reopened.connection, &target)
            .unwrap_err()
            .code,
        ErrorCode::AdmissionHeld
    );
}

#[test]
fn service_refusal_spans_hosted_targets_but_not_direct_keys() {
    let (_dir, mut store, first) = setup();
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
