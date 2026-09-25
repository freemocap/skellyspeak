use super::*;
use base64::Engine;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};

fn request(socket: &mut std::net::TcpStream) -> String {
    socket
        .set_read_timeout(Some(Duration::from_secs(10)))
        .unwrap();
    let mut bytes = Vec::new();
    loop {
        let mut byte = [0];
        socket.read_exact(&mut byte).unwrap();
        bytes.push(byte[0]);
        if bytes.ends_with(b"\r\n\r\n") {
            break;
        }
    }
    let headers = String::from_utf8(bytes).unwrap();
    let length = headers
        .lines()
        .find_map(|line| {
            line.to_lowercase()
                .strip_prefix("content-length: ")
                .and_then(|n| n.parse().ok())
        })
        .unwrap_or(0);
    let mut body = vec![0; length];
    socket.read_exact(&mut body).unwrap();
    headers + &String::from_utf8(body).unwrap()
}

fn respond(socket: &mut std::net::TcpStream, body: serde_json::Value) {
    let body = body.to_string();
    write!(
        socket,
        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    )
    .unwrap();
}

// Exercise real HTTP dispatch and receipt settlement, not just subscription bookkeeping.
#[tokio::test]
async fn invalid_independent_input_fails_before_execution() {
    let directory = tempfile::tempdir().unwrap();
    let state = Application::start(&directory.path().join("speech.sqlite3"), None);
    let target = access::ResolvedTarget {
        route: crate::model::ConnectionRoute::Custom,
        revision: 1,
        url: "http://127.0.0.1:1/v1/audio/speech".into(),
        model: "model".into(),
        credential: None,
    };
    let result = state
        .shared_speech(
            target,
            audio::SpeechInput {
                text: String::new(),
                language: "en".into(),
                voice: "unused".into(),
            },
            "workspace".into(),
            "consumer",
            || Ok(()),
        )
        .await;
    assert!(matches!(result,Err(e) if e.code == ErrorCode::Validation));
    let count: i64 = state
        .lock()
        .unwrap()
        .connection
        .query_row("SELECT count(*) FROM inference_consumers", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 0);
}

#[tokio::test]
async fn cancelling_one_consumer_preserves_shared_dispatch_and_receipt() {
    cancellation(false, false).await;
}

#[tokio::test]
async fn paused_speech_has_an_undispatched_shared_receipt() {
    let directory = tempfile::tempdir().unwrap();
    let state = Application::start(&directory.path().join("speech.sqlite3"), None);
    let (target, install) = {
        let store = state.lock().unwrap();
        store.connection.execute("UPDATE ai_config SET route='custom',paused=1,custom_config=json_set(custom_config,'$.baseUrl','http://127.0.0.1:1/v1','$.bearerAuth',json('false'))", []).unwrap();
        (
            access::resolve(&store.connection, access::Capability::Speech).unwrap(),
            store.snapshot().unwrap().learner.id,
        )
    };
    assert!(
        state
            .shared_speech(
                target,
                audio::SpeechInput {
                    text: "PRIVATE-UNSENT".into(),
                    language: "en".into(),
                    voice: "unused".into(),
                },
                install,
                "paused-consumer",
                || Ok(())
            )
            .await
            .is_err()
    );
    let store = state.lock().unwrap();
    let receipt = results::receipt_for_consumer(&store.connection, "paused-consumer")
        .unwrap()
        .unwrap();
    assert_eq!(receipt["state"], "failed");
    assert_eq!(receipt["dispatched"], false);
    assert!(!receipt.to_string().contains("PRIVATE-UNSENT"));
    assert_eq!(store.profile().unwrap().global.attempts, 0);
}

#[tokio::test]
async fn cancelling_all_consumers_after_dispatch_still_settles_receipt() {
    cancellation(true, false).await;
}

#[tokio::test]
async fn failed_audio_cache_write_preserves_provider_receipt_and_usage() {
    cancellation(false, true).await;
}

async fn cancellation(cancel_all: bool, reject_blob: bool) {
    let directory = tempfile::tempdir().unwrap();
    let state = Application::start(&directory.path().join("speech.sqlite3"), None);
    // Joining pending work remains available when retained reuse is disabled.
    if !cancel_all && !reject_blob {
        results::set_capacity(&state.lock().unwrap().connection, 0).unwrap();
    }
    if reject_blob {
        state.lock().unwrap().connection.execute_batch("CREATE TRIGGER reject_speech_blob BEFORE INSERT ON inference_blobs BEGIN SELECT RAISE(ABORT,'fixture cache failure'); END").unwrap();
    }
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let (target, install) = {
        let store = state.lock().unwrap();
        let base = format!("http://{}/v1", listener.local_addr().unwrap());
        store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl',?1,'$.bearerAuth',json('false'))", [&base]).unwrap();
        (
            access::resolve(&store.connection, access::Capability::Speech).unwrap(),
            store
                .connection
                .query_row("SELECT id FROM learner LIMIT 1", [], |r| {
                    r.get::<_, String>(0)
                })
                .unwrap(),
        )
    };
    let model = target.model.clone();
    let (started, dispatched) = tokio::sync::oneshot::channel();
    let (release, released) = std::sync::mpsc::channel();
    let worker = std::thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        let wire = request(&mut socket);
        assert!(wire.starts_with("POST /v1/audio/speech "));
        let body: serde_json::Value =
            serde_json::from_str(wire.split_once("\r\n\r\n").unwrap().1).unwrap();
        assert_eq!(body.as_object().unwrap().len(), 3);
        started.send(()).unwrap();
        released.recv_timeout(Duration::from_secs(10)).unwrap();
        let mut wav = std::io::Cursor::new(Vec::new());
        let mut writer = hound::WavWriter::new(
            &mut wav,
            hound::WavSpec {
                channels: 1,
                sample_rate: 24000,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            },
        )
        .unwrap();
        writer.write_sample(100_i16).unwrap();
        writer.finalize().unwrap();
        respond(
            &mut socket,
            json!({"version":1,"format":"wav",
            "audio_base64":base64::engine::general_purpose::STANDARD.encode(wav.into_inner()),
            "usage":{"requested_model":model,"actual_model":model,"provider":"elevenlabs","request_id":"shared-request","cost_micros":null,"allowance_micros":12}}),
        );
    });
    let active = AtomicBool::new(true);
    let input = audio::SpeechInput {
        text: "shared source".into(),
        language: "en".into(),
        voice: "unused".into(),
    };
    let first = state.shared_speech(
        target.clone(),
        input.clone(),
        install.clone(),
        "first",
        || {
            if active.load(Ordering::SeqCst) {
                Ok(())
            } else {
                Err(AppError::new(ErrorCode::Conflict, "Consumer closed."))
            }
        },
    );
    let second = state.shared_speech(target, input, install, "second", || {
        if !cancel_all || active.load(Ordering::SeqCst) {
            Ok(())
        } else {
            Err(AppError::new(ErrorCode::Conflict, "Consumer closed."))
        }
    });
    let controller = async {
        tokio::time::timeout(Duration::from_secs(5), dispatched)
            .await
            .unwrap()
            .unwrap();
        // Both futures have subscribed before the async HTTP response arrives.
        let count: i64 = state
            .lock()
            .unwrap()
            .connection
            .query_row("SELECT count(*) FROM inference_consumers", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2);
        active.store(false, Ordering::SeqCst);
    };
    let first_then_release = async {
        let result = first.await;
        assert!(matches!(result, Err(ref e) if e.code == ErrorCode::Conflict));
        if !cancel_all {
            release.send(()).unwrap();
        }
    };
    let second_then_release = async {
        let result = second.await;
        if cancel_all {
            assert!(matches!(result, Err(ref e) if e.code == ErrorCode::Conflict));
            release.send(()).unwrap();
        }
        result
    };
    let (_, saved, _) = tokio::time::timeout(Duration::from_secs(10), async {
        tokio::join!(first_then_release, second_then_release, controller)
    })
    .await
    .unwrap();
    worker.join().unwrap();
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let settled = results::receipt_for_consumer(&state.lock().unwrap().connection, "first")
                .unwrap()
                .is_some_and(|r| r["state"] == if reject_blob { "failed" } else { "succeeded" });
            if settled {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    let store = state.lock().unwrap();
    let receipt = results::receipt_for_consumer(&store.connection, "first")
        .unwrap()
        .unwrap();
    if reject_blob {
        let error = saved.err().unwrap();
        assert_eq!(error.code, ErrorCode::Storage);
        assert_eq!(
            error.diagnostics.unwrap()["response"]["providerId"],
            "shared-request"
        );
        assert!(
            results::for_consumer(&store.connection, "second")
                .unwrap()
                .is_none()
        );
        assert!(receipt["response"]["storageError"].is_object());
    } else if !cancel_all {
        assert_eq!(receipt["id"], saved.unwrap().execution);
    }
    assert_eq!(
        receipt["state"],
        if reject_blob { "failed" } else { "succeeded" }
    );
    assert_eq!(receipt["response"]["providerId"], "shared-request");
    assert!(receipt["response"]["costMicros"].is_null());
    assert!(!receipt.to_string().contains("shared source"));
    assert_eq!(store.profile().unwrap().global.attempts, 1);
    results::set_capacity(&store.connection, 0).unwrap();
    assert!(
        results::for_consumer(&store.connection, "first")
            .unwrap()
            .is_none()
    );
    assert_eq!(
        results::receipt_for_consumer(&store.connection, "first")
            .unwrap()
            .unwrap(),
        receipt
    );
}
