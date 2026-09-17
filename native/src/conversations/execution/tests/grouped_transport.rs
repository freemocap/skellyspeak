use super::*;

#[tokio::test]
async fn grouped_partial_result_is_durable_before_transport_failure() {
    check_grouped_partial_result(false, ConnectionRoute::Hosted).await;
}

#[tokio::test]
async fn r1_grouped_translations_keep_successful_siblings_and_usage() {
    for route in [ConnectionRoute::Hosted, ConnectionRoute::Custom] {
        check_grouped_partial_result(true, route).await;
    }
}

async fn check_grouped_partial_result(translations: bool, route: ConnectionRoute) {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let (_dir, mut store, first) = setup();
    let contact = store.snapshot().unwrap().contacts[0].id.clone();
    let second = apply(
        &mut store,
        Action::CreateConversation {
            contact_id: contact,
            title: "Second".into(),
        },
    )
    .entity_id;
    let mut dispatches = vec![begin(&mut store, &first), begin(&mut store, &second)];
    if translations {
        for dispatch in &dispatches {
            store.finish(dispatch, Ok(reply("Hola."))).unwrap();
        }
        dispatches = vec![
            store.dispatch().unwrap().unwrap(),
            store.dispatch().unwrap().unwrap(),
        ];
        for dispatch in &dispatches {
            assert_eq!(dispatch.messages.len(), 2);
            assert_eq!(dispatch.messages[1].content, "Hola.");
        }
    }
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/v1/operations", listener.local_addr().unwrap());
    for dispatch in &mut dispatches {
        dispatch.route = route;
        dispatch.target.route = route;
        dispatch.target.url = url.clone();
    }
    let content = if translations {
        translation_reply(&dispatches[1], "Hola").text
    } else {
        "Hola".into()
    };
    let response = serde_json::json!({"type":"result", "operation_id":dispatches[1].operation.replace('-',""),
        "attempt_id":dispatches[1].attempt,"response":{"id":"provider","model":"google/gemini-2.5-flash",
        "choices":[{"finish_reason":"stop","message":{"content":content}}],"usage":{"prompt_tokens":3,"completion_tokens":1}}});
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut input = Vec::new();
        loop {
            let mut chunk = [0u8; 4096];
            let count = socket.read(&mut chunk).await.unwrap();
            assert!(count > 0);
            input.extend_from_slice(&chunk[..count]);
            if let Some(start) = input.windows(4).position(|w| w == b"\r\n\r\n") {
                let header = String::from_utf8_lossy(&input[..start]).to_ascii_lowercase();
                let length: usize = header
                    .lines()
                    .find_map(|l| l.strip_prefix("content-length: "))
                    .unwrap()
                    .parse()
                    .unwrap();
                if input.len() < start + 4 + length {
                    continue;
                }
                let envelope: serde_json::Value =
                    serde_json::from_slice(&input[start + 4..]).unwrap();
                assert_eq!(envelope["items"].as_array().unwrap().len(), 2);
                break;
            }
        }
        let body = format!("{response}\n");
        socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len()).as_bytes()).await.unwrap();
    });
    let mut completed = Vec::new();
    let result = crate::ai::transport::grouped::request(
        &crate::ai::transport::provider::client().unwrap(),
        "test",
        &dispatches,
        |index, result| {
            store.finish(&dispatches[index], result)?;
            assert_eq!(
                store.conversation_snapshot(&second, None)?.messages.len(),
                2
            );
            completed.push(index);
            Ok(())
        },
    )
    .await;
    assert_eq!(result.as_ref().unwrap_err().code, ErrorCode::UnknownOutcome);
    for (index, dispatch) in dispatches.iter().enumerate() {
        if !completed.contains(&index) {
            store
                .finish(dispatch, Err(result.as_ref().unwrap_err().clone()))
                .unwrap();
        }
    }
    assert_eq!(completed, [1]);
    assert_eq!(
        store.conversation_snapshot(&second, None).unwrap().turns[0].state,
        if translations {
            "succeeded"
        } else {
            "assisting"
        }
    );
    let profile = store.profile().unwrap();
    assert_eq!(profile.global.attempts, if translations { 4 } else { 2 });
    assert_eq!(
        profile.global.input_tokens,
        if translations { 45 } else { 3 }
    );
    assert_eq!(
        profile.global.output_tokens,
        if translations { 17 } else { 1 }
    );
    assert_eq!(profile.global.unknown_usage, 1);
    if translations {
        assert_eq!(
            store.conversation_snapshot(&second, None).unwrap().messages[1]
                .translation
                .as_deref(),
            Some("Hola")
        );
        assert!(
            store.conversation_snapshot(&first, None).unwrap().messages[1]
                .translation
                .is_none()
        );
        assert!(store.dispatch().unwrap().is_none());
    }
    assert_eq!(
        store.conversation_snapshot(&first, None).unwrap().turns[0].state,
        "unknown"
    );
    server.await.unwrap();
}
