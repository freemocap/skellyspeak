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
async fn invalid_independent_input_fails_before_discovery_or_execution() {
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
    cancellation(false).await;
}

#[tokio::test]
async fn cancelling_all_consumers_after_dispatch_still_settles_receipt() {
    cancellation(true).await;
}

#[tokio::test]
async fn last_consumer_leaving_during_profile_discovery_prevents_synthesis() {
    let directory = tempfile::tempdir().unwrap();
    let state = Application::start(&directory.path().join("speech.sqlite3"), None);
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let (target, install) = {
        let store = state.lock().unwrap();
        let base = format!("http://{}/v1", listener.local_addr().unwrap());
        store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl',?1,'$.bearerAuth',json('false'))",[base]).unwrap();
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
    let service_scope = scope(&target, &install).unwrap();
    let model = target.model.clone();
    let (started, discovering) = tokio::sync::oneshot::channel();
    let (release, released) = std::sync::mpsc::channel();
    let worker = std::thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        assert!(request(&mut socket).starts_with("GET /v1/protocol "));
        started.send(()).unwrap();
        released.recv_timeout(Duration::from_secs(5)).unwrap();
        respond(
            &mut socket,
            json!({"protocol":"skellyspeak","version":1,"audio":{"speech_model":model,"synthesis_profile":"a".repeat(64)}}),
        );
    });
    let active = AtomicBool::new(true);
    let consumer = state.shared_speech(
        target,
        audio::SpeechInput {
            text: "never submitted".into(),
            language: "en".into(),
            voice: "unused".into(),
        },
        install,
        "cancelled",
        || {
            if active.load(Ordering::SeqCst) {
                Ok(())
            } else {
                Err(AppError::new(ErrorCode::Conflict, "Consumer closed."))
            }
        },
    );
    let controller = async {
        discovering.await.unwrap();
        active.store(false, Ordering::SeqCst);
    };
    let (result, _) = tokio::time::timeout(Duration::from_secs(5), async {
        tokio::join!(consumer, controller)
    })
    .await
    .unwrap();
    assert!(matches!(result,Err(e) if e.code==ErrorCode::Conflict));
    release.send(()).unwrap();
    worker.join().unwrap();
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if results::profile(&state.lock().unwrap().connection, &service_scope)
                .unwrap()
                .is_some()
            {
                break;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    let count: i64 = state
        .lock()
        .unwrap()
        .connection
        .query_row("SELECT count(*) FROM inference_executions", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(count, 0);
}

async fn cancellation(cancel_all: bool) {
    let directory = tempfile::tempdir().unwrap();
    let state = Application::start(&directory.path().join("speech.sqlite3"), None);
    // Joining pending work remains available when retained reuse is disabled.
    if !cancel_all {
        results::set_capacity(&state.lock().unwrap().connection, 0).unwrap();
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
        let profile = "a".repeat(64);
        let (mut socket, _) = listener.accept().unwrap();
        assert!(request(&mut socket).starts_with("GET /v1/protocol "));
        respond(
            &mut socket,
            json!({"protocol":"skellyspeak","version":1,"audio":{"speech_model":model,"synthesis_profile":profile}}),
        );
        drop(socket);
        let (mut socket, _) = listener.accept().unwrap();
        assert!(request(&mut socket).starts_with("POST /v1/audio/speech "));
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
            json!({"version":1,"synthesis_profile":profile,"format":"wav",
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
                .is_some_and(|r| r["state"] == "succeeded");
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
    if !cancel_all {
        assert_eq!(receipt["id"], saved.unwrap().execution);
    }
    assert_eq!(receipt["state"], "succeeded");
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
