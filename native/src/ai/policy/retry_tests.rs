use super::*;
use std::cell::{Cell, RefCell};

fn limited() -> AppError {
    AppError::new(
        ErrorCode::Provider,
        "Chat HTTP 429: temporarily limited. No automatic retry was made.",
    )
    .with_diagnostics(json!({"status":429,"response_headers":{"request_id":"request-1"}}))
}
fn completion() -> Completion {
    Completion {
        diagnostics: Some(json!({"id":"success","usage":{"cost":0.001}})),
        text: "OK".into(),
        finish_reason: "stop".into(),
        actual_model: "actual".into(),
        provider_id: "success".into(),
        input_tokens: Some(10),
        output_tokens: Some(1),
    }
}

#[test]
fn backoff_is_bounded_and_respects_retry_after() {
    let mut error = limited();
    assert_eq!(
        delay(&error, 0, Duration::ZERO, 0),
        Some(Duration::from_secs(1))
    );
    assert_eq!(
        delay(&error, 1, Duration::ZERO, 0),
        Some(Duration::from_secs(2))
    );
    assert_eq!(
        delay(&error, 2, Duration::ZERO, 250),
        Some(Duration::from_millis(4250))
    );
    assert_eq!(delay(&error, 3, Duration::ZERO, 0), None);
    error.diagnostics.as_mut().unwrap()["response_headers"]["retry_after"] = json!("10");
    assert_eq!(
        delay(&error, 0, Duration::ZERO, 0),
        Some(Duration::from_secs(10))
    );
    assert_eq!(delay(&error, 0, Duration::from_secs(25), 0), None);
    for header in ["300", "invalid"] {
        error.diagnostics.as_mut().unwrap()["response_headers"]["retry_after"] = json!(header);
        assert_eq!(delay(&error, 0, Duration::ZERO, 0), None);
    }
    error.diagnostics.as_mut().unwrap()["response_headers"]["retry_after"] = json!(
        httpdate::fmt_http_date(SystemTime::now() + Duration::from_secs(10))
    );
    assert!(delay(&error, 0, Duration::ZERO, 0).unwrap() >= Duration::from_secs(9));
}

#[test]
fn retries_only_explicit_rate_limits_without_partial_text() {
    for metadata in [
        json!({"stage":"provider_completion","chars":0,"response":{"choices":[{"error":{"code":429}}]}}),
        json!({"stage":"stream","chars":0,"error":{"code":"429"}}),
    ] {
        let mut error = limited().with_diagnostics(metadata);
        assert!(delay(&error, 0, Duration::ZERO, 0).is_some());
        error.diagnostics.as_mut().unwrap()["chars"] = json!(1);
        assert!(delay(&error, 0, Duration::ZERO, 0).is_none());
    }
    for metadata in [
        json!({"status":401}),
        json!({"status":403}),
        json!({"status":503}),
        json!({"stage":"stream","chars":0}),
        json!({"message":"429 rate limit"}),
    ] {
        assert!(delay(&limited().with_diagnostics(metadata), 0, Duration::ZERO, 0).is_none());
    }
    let mut error = limited();
    error.code = ErrorCode::Validation;
    assert!(delay(&error, 0, Duration::ZERO, 0).is_none());
}

#[tokio::test]
async fn eventual_success_retains_refusal_and_persists_before_retry() {
    let count = Cell::new(0);
    let saved = RefCell::new(Vec::new());
    let result = run(
        || {
            count.set(count.get() + 1);
            let result = if count.get() == 1 {
                Err(limited())
            } else {
                assert_eq!(saved.borrow().len(), 1);
                Ok(completion())
            };
            async { result }
        },
        || Ok(()),
        |error| {
            saved.borrow_mut().push(error.clone());
            Ok(())
        },
    )
    .await
    .unwrap();
    assert_eq!(count.get(), 2);
    let d = result.diagnostics.unwrap();
    assert_eq!(d["id"], "success");
    assert_eq!(
        d["automatic_retries"][0]["error"]["diagnostics"]["response_headers"]["request_id"],
        "request-1"
    );
    assert_eq!(d["usage"]["cost"], 0.001);
}

#[tokio::test]
async fn stops_after_three_retries_and_keeps_all_refusals() {
    let count = Cell::new(0);
    let error = run::<_, _, _, _, Result<Completion>>(
        || {
            count.set(count.get() + 1);
            async { Err(limited()) }
        },
        || Ok(()),
        |_| Ok(()),
    )
    .await
    .unwrap_err();
    assert_eq!(count.get(), 4);
    assert_eq!(
        error.diagnostics.unwrap()["automatic_retries"]
            .as_array()
            .unwrap()
            .len(),
        3
    );
    assert!(error.message.contains("retries scheduled: 3"));
    assert!(!error.message.contains("No automatic retry"));
}

#[tokio::test]
async fn revocation_during_wait_prevents_resubmission_and_keeps_history() {
    let count = Cell::new(0);
    let revoked = Cell::new(false);
    let error = run::<_, _, _, _, Result<Completion>>(
        || {
            count.set(count.get() + 1);
            async { Err(limited()) }
        },
        || {
            if revoked.get() {
                Err(AppError::new(ErrorCode::Conflict, "Revoked"))
            } else {
                Ok(())
            }
        },
        |_| {
            revoked.set(true);
            Ok(())
        },
    )
    .await
    .unwrap_err();
    assert_eq!(count.get(), 1);
    assert_eq!(error.code, ErrorCode::Conflict);
    assert_eq!(
        error.diagnostics.unwrap()["automatic_retries"][0]["error"]["diagnostics"]["status"],
        429
    );
}

#[tokio::test]
async fn permanent_errors_and_persistence_failures_never_resubmit() {
    for fail_save in [false, true] {
        let count = Cell::new(0);
        let result = run::<_, _, _, _, Result<Completion>>(
            || {
                count.set(count.get() + 1);
                async {
                    if fail_save {
                        Err(limited())
                    } else {
                        Err(AppError::new(ErrorCode::Validation, "Invalid evidence"))
                    }
                }
            },
            || Ok(()),
            |_| Err(AppError::new(ErrorCode::Storage, "Cannot record retry")),
        )
        .await;
        assert!(result.is_err());
        assert_eq!(count.get(), 1);
    }
}

#[tokio::test]
async fn real_embedded_429_retries_and_records_redacted_receipt_before_success() {
    use crate::ai::transport::provider::{self, RequestOutput};
    use crate::model::{Action, Command, ConnectionRoute};
    use crate::storage::store::Store;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    let directory = tempfile::tempdir().unwrap();
    let mut store = Store::open(&directory.path().join("retry.sqlite3")).unwrap();
    store.prepare_chat().unwrap();
    store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl','http://127.0.0.1:8765/v1','$.bearerAuth',json('false'))", []).unwrap();
    let conversation = store.snapshot().unwrap().conversations[0].clone();
    store
        .execute(Command {
            session_id: store.session_id.clone(),
            action_id: uuid::Uuid::new_v4().to_string(),
            action: Action::SendMessage {
                conversation_id: conversation.id,
                expected_revision: conversation.revision,
                text: "Hola".into(),
                input: Default::default(),
            },
        })
        .unwrap();
    let mut dispatch = (0..20).find_map(|_| store.dispatch().unwrap()).unwrap();
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    dispatch.target.url = format!("http://{}/chat/completions", listener.local_addr().unwrap());
    dispatch.route = ConnectionRoute::Openrouter;
    let server = tokio::spawn(async move {
        for first in [true, false] {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            loop {
                let mut chunk = [0; 4096];
                let n = socket.read(&mut chunk).await.unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&chunk[..n]);
                if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..end]);
                    let length: usize = headers
                        .lines()
                        .find_map(|s| {
                            s.to_lowercase()
                                .strip_prefix("content-length:")
                                .map(|s| s.trim().parse().unwrap())
                        })
                        .unwrap();
                    if bytes.len() >= end + 4 + length {
                        break;
                    }
                }
            }
            let choice = if first {
                json!({"finish_reason":"error","message":{"content":""},"error":{"code":429,"message":"Temporarily limited token=private-secret"}})
            } else {
                json!({"finish_reason":"stop","message":{"content":"Hola"}})
            };
            let body = json!({"id":if first {"refusal-id"} else {"success-id"},"model":"actual","choices":[choice],"usage":{"prompt_tokens":0,"completion_tokens":0,"cost":0}}).to_string();
            socket
                .write_all(
                    format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    )
                    .as_bytes(),
                )
                .await
                .unwrap();
        }
    });
    let store = RefCell::new(store);
    let schema = json!({"type":"object"});
    let client = provider::client().unwrap();
    let output = RequestOutput::JsonSchema {
        max_output_tokens: 128,
        name: "test",
        schema: &schema,
    };
    let result = run(
        || provider::complete_with_output(&client, "private-secret", &dispatch, output),
        || {
            assert!(store.borrow().attempt_active(&dispatch.attempt)?);
            Ok(())
        },
        |error| store.borrow_mut().record_retry(&dispatch, error),
    )
    .await
    .unwrap();
    server.await.unwrap();
    assert_eq!(result.provider_id, "success-id");
    let d = result.diagnostics.unwrap();
    assert_eq!(
        d["automatic_retries"][0]["error"]["diagnostics"]["response"]["id"],
        "refusal-id"
    );
    assert!(!d.to_string().contains("private-secret"));
    let saved: String = store
        .borrow()
        .connection
        .query_row(
            "SELECT diagnostics FROM attempts WHERE id=?1",
            [&dispatch.attempt],
            |r| r.get(0),
        )
        .unwrap();
    assert!(saved.contains("refusal-id"));
    assert!(saved.contains("automatic_retries"));
    assert!(!saved.contains("private-secret"));
}

fn busy_audio() -> AppError {
    AppError::new(ErrorCode::UnknownOutcome, "ElevenLabs system_busy").with_diagnostics(
        json!({"stage":"http", "status":502, "response": {
            "provider_error":{"code":"system_busy", "message":"Heavy traffic"},
            "diagnostics":{"http":{"status":429,"response_headers":{"retry_after":"1"}},
                           "detail":{"request_id":"eleven-request"}}
        }}),
    )
}

#[test]
fn recognizes_wrapped_provider_limits_but_not_quota_or_group_replays() {
    assert_eq!(
        delay(&busy_audio(), 0, Duration::ZERO, 0),
        Some(Duration::from_secs(1))
    );
    let mut quota = busy_audio();
    quota.diagnostics.as_mut().unwrap()["response"]["provider_error"]["code"] =
        json!("quota_exceeded");
    assert!(delay(&quota, 0, Duration::ZERO, 0).is_none());
    for d in [
        json!({"status":502}),
        json!({"stage":"grouped_operation","status":429}),
        json!({"status":429,"automatic_retries":[{}]}),
        json!({"status":429,"chars":1}),
    ] {
        assert!(delay(&limited().with_diagnostics(d), 0, Duration::ZERO, 0).is_none());
    }
}

#[tokio::test]
async fn transcription_and_speech_share_the_runner_and_retain_history() {
    let calls = Cell::new(0);
    let result: Result<TranscriptionOutcome> = run(
        || {
            calls.set(calls.get() + 1);
            async {
                if calls.get() == 1 {
                    Err(busy_audio())
                } else {
                    Ok(TranscriptionOutcome {
                        diagnostics: Some(json!({"request_id":"success"})),
                        result: crate::ai::audio::TranscriptionResult {
                            text: "hello".into(),
                            timing: None,
                        },
                    })
                }
            }
        },
        || Ok(()),
        |_| Ok(()),
    )
    .await;
    let result = result.unwrap();
    assert_eq!(calls.get(), 2);
    assert_eq!(result.result.text, "hello");
    let history = result.diagnostics.unwrap();
    assert_eq!(
        history["automatic_retries"][0]["error"]["diagnostics"]["response"]["diagnostics"]["detail"]
            ["request_id"],
        "eleven-request"
    );

    calls.set(0);
    let speech = run(
        || {
            calls.set(calls.get() + 1);
            async {
                let mut value = SpeechOutcome::empty();
                value.audio = if calls.get() == 1 {
                    Err(busy_audio())
                } else {
                    Ok(vec![1, 2])
                };
                value
            }
        },
        || Ok(()),
        |_| Ok(()),
    )
    .await;
    assert_eq!(speech.audio.unwrap(), vec![1, 2]);
    assert_eq!(
        speech.diagnostics.unwrap()["automatic_retries"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}
