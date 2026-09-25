use super::*;
use crate::ai::{
    audio::{TranscriptionRequest, TranscriptionResult},
    results,
};
use serde_json::json;
use std::{
    io::{Read, Write},
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

fn server(
    body: serde_json::Value,
) -> (
    String,
    tokio::sync::oneshot::Receiver<()>,
    std::sync::mpsc::Sender<()>,
    std::thread::JoinHandle<Vec<u8>>,
) {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/v1", listener.local_addr().unwrap());
    let (sent, received) = tokio::sync::oneshot::channel();
    let (release, gate) = std::sync::mpsc::channel();
    let worker = std::thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut request = Vec::new();
        loop {
            let mut buffer = [0; 4096];
            let count = socket.read(&mut buffer).unwrap();
            assert!(count > 0);
            request.extend_from_slice(&buffer[..count]);
            if let Some(end) = request.windows(4).position(|w| w == b"\r\n\r\n") {
                let headers = String::from_utf8_lossy(&request[..end]).to_lowercase();
                assert!(headers.starts_with("post /v1/audio/transcriptions "));
                let length: usize = headers
                    .lines()
                    .find_map(|l| l.strip_prefix("content-length: "))
                    .unwrap()
                    .parse()
                    .unwrap();
                if request.len() >= end + 4 + length {
                    break;
                }
            }
        }
        sent.send(()).unwrap();
        gate.recv_timeout(Duration::from_secs(5)).unwrap();
        let body = body.to_string();
        write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
        request
    });
    (url, received, release, worker)
}
fn reply() -> serde_json::Value {
    json!({"text":"Hola","request_id":"recognition-fixture","timing":{"text":"Hola","duration":1.0,"words":[{"word":"Hola","start":0.1,"end":0.6}]},"segments":[{"avg_logprob":-0.05,"no_speech_prob":0.01}]})
}
fn setup(
    url: &str,
) -> (
    tempfile::TempDir,
    Arc<Application>,
    Transcription,
    TranscriptionRequest,
) {
    let dir = tempfile::tempdir().unwrap();
    let app = Application::recording_fixture(&dir.path().join("transcription.sqlite3"));
    let mut store = app.lock().unwrap();
    store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl',?1,'$.bearerAuth',json('false'))",[url]).unwrap();
    let item = store
        .create_drill_item(crate::drill::DrillItemInput {
            text: "Hola".into(),
            language: "spanish".into(),
            variety: None,
            explanation: "english".into(),
            explanation_variety: None,
        })
        .unwrap();
    let session = store.start_drill_session("spanish").unwrap();
    let visit = store.enter_drill_visit(&session, &item.id).unwrap();
    let owner = RecordingOwner::DrillItem(item.id);
    let scope = owner.scope(&store).unwrap();
    let recording = Transcription {
        id: "take-1".into(),
        install: store.snapshot().unwrap().learner.id,
        owner,
        visit: Some(visit),
        target: access::resolve(&store.connection, access::Capability::Transcription).unwrap(),
        language: scope.language,
        context: scope.context,
    };
    let wav = super::super::wav::encode_wav(
        &(0..8000)
            .map(|i| ((i as f32) * 0.1).sin() * 0.2)
            .collect::<Vec<_>>(),
        8000,
    )
    .unwrap();
    let input = TranscriptionRequest {
        wav,
        language: recording.language.clone(),
        context: recording.context.clone(),
    };
    drop(store);
    (dir, app, recording, input)
}

#[tokio::test]
async fn chat_and_drill_share_recognition_but_publish_independently_and_reuse_after_restart() {
    let (url, ready, release, worker) = server(reply());
    let (dir, app, drill, input) = setup(&url);
    let mut chat = drill.clone();
    chat.id = "chat-take".into();
    chat.visit = None;
    {
        let mut store = app.lock().unwrap();
        store.prepare_chat().unwrap();
        chat.owner =
            RecordingOwner::Conversation(store.snapshot().unwrap().conversations[0].id.clone());
    }
    let gate = async {
        ready.await.unwrap();
        release.send(()).unwrap();
    };
    let (a, b, _) = tokio::join!(
        transcribe(app.clone(), drill.clone(), input.wav.clone()),
        transcribe(app.clone(), chat.clone(), input.wav.clone()),
        gate
    );
    let a = a.unwrap();
    let b = b.unwrap();
    assert_eq!(a.text, "Hola");
    assert_eq!(a.text, b.text);
    assert_eq!(
        a.diagnostics.as_ref().unwrap()["sourceExecutionId"],
        b.diagnostics.as_ref().unwrap()["sourceExecutionId"]
    );
    assert!(
        a.diagnostics
            .as_ref()
            .unwrap()
            .get("drill_reliability")
            .is_some()
    );
    assert!(
        b.diagnostics
            .as_ref()
            .unwrap()
            .get("drill_reliability")
            .is_none()
    );
    let request = worker.join().unwrap();
    let wire = String::from_utf8_lossy(&request);
    assert!(wire.contains("name=\"prompt\"\r\n\r\nHola"));
    assert!(wire.contains("name=\"language\""));
    {
        let store = app.lock().unwrap();
        assert_eq!(
            store
                .drill_attempts(drill.owner.id(), None, 10)
                .unwrap()
                .attempts
                .len(),
            1
        );
        assert!(
            store
                .conversation_snapshot(chat.owner.id(), None)
                .unwrap()
                .messages
                .is_empty()
        );
        let profile = store.profile().unwrap();
        assert_eq!(profile.global.attempts, 1);
        assert_eq!(
            profile
                .languages
                .iter()
                .find(|l| l.id == "spanish")
                .unwrap()
                .attempts,
            1
        );
        assert_eq!(profile.personas.iter().map(|p| p.attempts).sum::<i32>(), 1);
        let receipts = super::super::transcription::views(&store.connection, &drill.owner).unwrap();
        assert!(
            receipts[0]
                .diagnostics
                .as_ref()
                .unwrap()
                .to_string()
                .contains("recognition-fixture")
        );
    }
    assert!(
        transcribe(app.clone(), drill.clone(), input.wav.clone())
            .await
            .is_err()
    );
    drop(app);
    let app = Application::recording_fixture(&dir.path().join("transcription.sqlite3"));
    let mut next = drill.clone();
    next.id = "take-after-restart".into();
    let result = transcribe(app.clone(), next, input.wav.clone())
        .await
        .unwrap();
    assert_eq!(result.diagnostics.unwrap()["cacheHit"], true);
    assert_eq!(
        app.lock()
            .unwrap()
            .drill_attempts(drill.owner.id(), None, 10)
            .unwrap()
            .attempts
            .len(),
        2
    );
    assert_eq!(app.lock().unwrap().profile().unwrap().global.attempts, 1);
    results::set_capacity(&app.lock().unwrap().connection, 0).unwrap();
    assert_eq!(
        results::settings(&app.lock().unwrap().connection)
            .unwrap()
            .result_count,
        0
    );
    assert_eq!(
        app.lock()
            .unwrap()
            .drill_attempts(drill.owner.id(), None, 10)
            .unwrap()
            .attempts
            .len(),
        2
    );
    let saved = crate::speech::recording::results::load(
        &app.lock().unwrap().connection,
        &drill.id,
        &input.wav,
    )
    .unwrap()
    .unwrap();
    assert_eq!(saved.timing.as_ref().unwrap().words[0].word, "Hola");
    assert_eq!(saved.timing.as_ref().unwrap().words[0].start, 0.1);
    assert!(
        crate::speech::recording::results::load(
            &app.lock().unwrap().connection,
            &drill.id,
            b"different"
        )
        .is_err()
    );
    drop(app);
    let app = Application::recording_fixture(&dir.path().join("transcription.sqlite3"));
    assert_eq!(
        crate::speech::recording::results::load(
            &app.lock().unwrap().connection,
            &drill.id,
            &input.wav
        )
        .unwrap()
        .unwrap()
        .timing
        .unwrap()
        .words[0]
            .end,
        0.6
    );
    let receipt = results::receipt_for_consumer(&app.lock().unwrap().connection, &drill.id)
        .unwrap()
        .unwrap();
    assert_eq!(receipt["state"], "succeeded");
    assert!(!receipt.to_string().contains("Hola"));
    let mut store = app.lock().unwrap();
    let attempt = store
        .drill_attempts(drill.owner.id(), None, 10)
        .unwrap()
        .attempts
        .into_iter()
        .find(|attempt| attempt.transcription_attempt_id.as_deref() == Some(&drill.id))
        .unwrap();
    store.delete_drill_attempt(&attempt.id).unwrap();
    assert!(
        crate::speech::recording::results::result(&store.connection, &drill.id)
            .unwrap()
            .is_none()
    );
    assert!(
        results::receipt_for_consumer(&store.connection, &drill.id)
            .unwrap()
            .is_some()
    );
}

#[tokio::test]
async fn leaving_one_or_all_consumers_does_not_abandon_submitted_recognition() {
    for keep_second in [true, false] {
        let (url, ready, release, worker) = server(reply());
        let (_dir, app, recording, input) = setup(&url);
        let alive = AtomicBool::new(true);
        let validate = || {
            if alive.load(Ordering::SeqCst) {
                Ok(())
            } else {
                Err(AppError::new(ErrorCode::Conflict, "Recording closed."))
            }
        };
        let second = || if keep_second { Ok(()) } else { validate() };
        let cancel = async {
            ready.await.unwrap();
            alive.store(false, Ordering::SeqCst);
            tokio::time::sleep(Duration::from_millis(120)).await;
            release.send(()).unwrap();
        };
        let (a, b, _) = tokio::join!(
            app.shared_transcription(
                recording.target.clone(),
                input.clone(),
                recording.install.clone(),
                "a",
                validate
            ),
            app.shared_transcription(
                recording.target.clone(),
                input.clone(),
                recording.install.clone(),
                "b",
                second
            ),
            cancel
        );
        assert!(a.is_err());
        assert_eq!(b.is_ok(), keep_second);
        worker.join().unwrap();
        tokio::time::timeout(Duration::from_secs(3), async {
            loop {
                let receipt = results::receipt_for_consumer(&app.lock().unwrap().connection, "a")
                    .unwrap()
                    .unwrap();
                if receipt["state"] == "succeeded" {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(5)).await;
            }
        })
        .await
        .unwrap();
        let saved = app
            .shared_transcription(recording.target, input, recording.install, "later", || {
                Ok(())
            })
            .await
            .unwrap();
        assert!(saved.cached);
        let decoded: TranscriptionResult = serde_json::from_slice(&saved.payload).unwrap();
        assert_eq!(decoded.timing.unwrap().words[0].word, "Hola");
        assert_eq!(app.lock().unwrap().profile().unwrap().global.attempts, 1);
    }
}

#[tokio::test]
async fn failed_provider_contract_keeps_metadata_without_publishing_or_caching() {
    let (url, ready, release, worker) = server(json!({"request_id":"failed-recognition","text":3}));
    let (_dir, app, recording, input) = setup(&url);
    let gate = async {
        ready.await.unwrap();
        release.send(()).unwrap();
    };
    let (result, _) = tokio::join!(transcribe(app.clone(), recording.clone(), input.wav), gate);
    assert!(result.is_err());
    worker.join().unwrap();
    let store = app.lock().unwrap();
    let receipt = results::receipt_for_consumer(&store.connection, &recording.id)
        .unwrap()
        .unwrap();
    assert_eq!(receipt["state"], "unknown");
    assert_eq!(receipt["dispatched"], true);
    assert!(receipt.to_string().contains("failed-recognition"));
    assert_eq!(
        results::settings(&store.connection).unwrap().result_count,
        0
    );
    assert!(
        store
            .drill_attempts(recording.owner.id(), None, 10)
            .unwrap()
            .attempts
            .is_empty()
    );
    assert_eq!(store.profile().unwrap().global.attempts, 1);
}

#[test]
fn identity_includes_audio_context_language_and_access_but_not_recording_owner() {
    let (_dir, _app, recording, input) = setup("http://127.0.0.1:1/v1");
    let key = |target: &access::ResolvedTarget, input: &TranscriptionRequest, install: &str| {
        results::transcription::request_key(target, input, install).unwrap()
    };
    let original = key(&recording.target, &input, &recording.install);
    let mut changed = input.clone();
    changed.wav[50] ^= 1;
    assert_ne!(
        original,
        key(&recording.target, &changed, &recording.install)
    );
    let mut changed = input.clone();
    changed.context = Some("Different prompt".into());
    assert_ne!(
        original,
        key(&recording.target, &changed, &recording.install)
    );
    let mut changed = input.clone();
    changed.language.variety_id.push_str("-different");
    assert_ne!(
        original,
        key(&recording.target, &changed, &recording.install)
    );
    let mut target = recording.target.clone();
    target.model.push_str("-different");
    assert_ne!(original, key(&target, &input, &recording.install));
    assert_ne!(
        original,
        key(&recording.target, &input, "another-workspace")
    );
}

#[tokio::test]
async fn removing_the_recording_owner_prevents_publication_but_retains_paid_execution() {
    let (url, ready, release, worker) = server(reply());
    let (_dir, app, recording, input) = setup(&url);
    let close = async {
        ready.await.unwrap();
        app.lock()
            .unwrap()
            .connection
            .execute(
                "UPDATE drill_items SET archived=1 WHERE id=?1",
                [recording.owner.id()],
            )
            .unwrap();
        tokio::time::sleep(Duration::from_millis(120)).await;
        release.send(()).unwrap();
    };
    let (result, _) = tokio::join!(transcribe(app.clone(), recording.clone(), input.wav), close);
    assert!(result.is_err());
    worker.join().unwrap();
    tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            let receipt =
                results::receipt_for_consumer(&app.lock().unwrap().connection, &recording.id)
                    .unwrap()
                    .unwrap();
            if receipt["state"] == "succeeded" {
                break;
            }
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
    })
    .await
    .unwrap();
    let store = app.lock().unwrap();
    let receipts = super::super::transcription::views(&store.connection, &recording.owner).unwrap();
    assert_eq!(receipts[0].state, "unknown");
    assert_eq!(
        receipts[0].diagnostics.as_ref().unwrap()["sourceExecution"]["state"],
        "succeeded"
    );
    let attempts: i64 = store
        .connection
        .query_row("SELECT count(*) FROM drill_attempts", [], |r| r.get(0))
        .unwrap();
    assert_eq!(attempts, 0);
    assert_eq!(store.profile().unwrap().global.attempts, 1);
}

#[tokio::test]
async fn cache_write_failure_retains_provider_metadata_and_admission_failure_is_not_paid() {
    let (url, ready, release, worker) = server(reply());
    let (_dir, app, recording, input) = setup(&url);
    app.lock().unwrap().connection.execute_batch("CREATE TRIGGER reject_cache BEFORE INSERT ON inference_results BEGIN SELECT RAISE(ABORT,'cache refused'); END;").unwrap();
    let gate = async {
        ready.await.unwrap();
        release.send(()).unwrap();
    };
    let (result, _) = tokio::join!(
        transcribe(app.clone(), recording.clone(), input.wav.clone()),
        gate
    );
    assert!(result.is_err());
    worker.join().unwrap();
    let receipt = results::receipt_for_consumer(&app.lock().unwrap().connection, &recording.id)
        .unwrap()
        .unwrap();
    assert_eq!(receipt["state"], "failed");
    assert!(receipt.to_string().contains("recognition-fixture"));
    assert!(!receipt.to_string().contains("Hola"));
    app.lock()
        .unwrap()
        .connection
        .execute("UPDATE ai_config SET paused=1", [])
        .unwrap();
    let held = app
        .shared_transcription(
            recording.target,
            input,
            recording.install,
            "held",
            || Ok(()),
        )
        .await;
    assert!(held.is_err());
    let receipt = results::receipt_for_consumer(&app.lock().unwrap().connection, "held")
        .unwrap()
        .unwrap();
    assert_eq!(receipt["dispatched"], false);
    assert_eq!(app.lock().unwrap().profile().unwrap().global.attempts, 1);
}
