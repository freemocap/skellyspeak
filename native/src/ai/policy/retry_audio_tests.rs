//! Real adapter -> hosted error decoding -> shared retry -> transcription receipt.
use super::*;
use crate::ai::{audio, connections::access::ResolvedTarget};
use crate::model::ConnectionRoute;
use std::cell::RefCell;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[tokio::test]
async fn wrapped_busy_transcription_reuses_recording_and_keeps_provider_reason() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let target = ResolvedTarget {
        audio_resolution: None,
        route: ConnectionRoute::Custom,
        revision: 1,
        url: format!(
            "http://{}/v1/audio/transcriptions",
            listener.local_addr().unwrap()
        ),
        model: "scribe_v2".into(),
        credential: None,
    };
    let server = tokio::spawn(async move {
        for first in [true, false] {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            loop {
                let mut chunk = [0; 4096];
                let count = socket.read(&mut chunk).await.unwrap();
                assert!(count > 0);
                bytes.extend_from_slice(&chunk[..count]);
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
            let request = String::from_utf8_lossy(&bytes);
            assert!(request.contains("recording-content"));
            assert!(request.contains("scribe_v2"));
            let (status, body) = if first {
                (
                    502,
                    json!({"code":"ELEVENLABS_HTTP_429", "detail":"Heavy traffic",
                    "provider_error":{"code":"system_busy","message":"Heavy traffic"},
                    "diagnostics":{"detail":{"request_id":"eleven-busy"},"http":{"status":429}}}),
                )
            } else {
                (200, json!({"text":"Hello"}))
            };
            let body = body.to_string();
            socket.write_all(format!("HTTP/1.1 {status} Response\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes()).await.unwrap();
        }
    });
    let input = audio::TranscriptionRequest {
        wav: b"recording-content".to_vec(),
        language: crate::ai::audio::TranscriptionLanguage {
            language_id: "es".into(),
            variety_id: "default".into(),
            language_tag: "es".into(),
        },
        context: Some(String::new()),
    };
    let client = crate::ai::transport::provider::client().unwrap();
    let saved = RefCell::new(Vec::new());
    let result = run(
        || {
            audio::transcribe(
                &client,
                &target,
                "credential-secret",
                input.clone(),
                "install",
            )
        },
        || Ok(()),
        |error| {
            saved.borrow_mut().push(error.clone());
            Ok(())
        },
    )
    .await
    .unwrap();
    server.await.unwrap();
    assert_eq!(result.result.text, "Hello");
    assert_eq!(saved.borrow().len(), 1);
    let metadata = result.diagnostics.unwrap().to_string();
    assert!(metadata.contains("eleven-busy"));
    assert!(metadata.contains("system_busy"));
    assert!(!metadata.contains("recording-content"));
    assert!(!metadata.contains("credential-secret"));
}

#[tokio::test]
async fn non_retryable_speech_failure_preserves_partial_metadata() {
    let result = run(
        || async {
            let mut result = SpeechOutcome::empty();
            result.cost_micros = Some(42);
            result.diagnostics = Some(json!({"request_id":"partial-receipt"}));
            result.audio = Err(AppError::new(ErrorCode::Validation, "Invalid audio"));
            result
        },
        || Ok(()),
        |_| panic!("must not retry"),
    )
    .await;
    assert!(result.audio.is_err());
    assert_eq!(result.cost_micros, Some(42));
    assert_eq!(result.diagnostics.unwrap()["request_id"], "partial-receipt");
}
