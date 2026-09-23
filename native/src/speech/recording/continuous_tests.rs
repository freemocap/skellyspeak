use super::*;
use std::io::{Read, Write};
fn server(count: usize) -> (String, std::thread::JoinHandle<()>, Arc<AtomicBool>) {
    let gate = Arc::new(AtomicBool::new(true));
    let response_gate = gate.clone();
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let base = format!("http://{}/v1", listener.local_addr().unwrap());
    let thread = std::thread::spawn(move || {
        for _ in 0..count {
            let began = Instant::now();
            let mut socket = loop {
                if let Ok((socket, _)) = listener.accept() {
                    break socket;
                }
                assert!(
                    began.elapsed().as_secs() < 10,
                    "transcription request not received"
                );
                std::thread::sleep(std::time::Duration::from_millis(10));
            };
            socket.set_nonblocking(false).unwrap();
            socket
                .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                .unwrap();
            let mut bytes = vec![];
            loop {
                let mut buffer = [0; 4096];
                let n = socket.read(&mut buffer).unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buffer[..n]);
                if let Some(end) = bytes.windows(4).position(|s| s == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
                    let size: usize = headers
                        .lines()
                        .find_map(|s| s.strip_prefix("content-length: "))
                        .unwrap()
                        .parse()
                        .unwrap();
                    if bytes.len() >= end + 4 + size {
                        break;
                    }
                }
            }
            let waiting = Instant::now();
            while !response_gate.load(Ordering::SeqCst) {
                assert!(waiting.elapsed().as_secs() < 10);
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
            let body = r#"{"text":"Hola","request_id":"fixture-transcription"}"#;
            write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
        }
    });
    (base, thread, gate)
}
fn fixture(
    pcm: Vec<f32>,
    url: &str,
) -> (tempfile::TempDir, Arc<Application>, Arc<Session>, String) {
    let dir = tempfile::tempdir().unwrap();
    let app = Application::recording_fixture(&dir.path().join("continuous.sqlite3"));
    let item = {
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
        store.enter_drill_visit(&session, &item.id).unwrap();
        item.id
    };
    *app.capture.lock().unwrap() = Some(voice::fixture(
        &app,
        RecordingOwner::DrillItem(item.clone()),
        pcm,
    ));
    let session = Arc::new(Session::new(
        "continuous-fixture".into(),
        ListeningSettings {
            pause_ms: 1000,
            silence_timeout_ms: 10000,
            threshold_offset_db: 10.0,
            min_take_ms: 160,
        },
    ));
    session.stop.store(1, Ordering::SeqCst);
    *app.listening.lock().unwrap() = Some(session.clone());
    (dir, app, session, item)
}
fn takes(count: usize) -> Vec<f32> {
    let mut pcm = vec![0.0; 4000];
    for _ in 0..count {
        pcm.extend(vec![0.1; 4000]);
        pcm.extend(vec![0.0; 8800]);
    }
    pcm
}
#[tokio::test]
async fn three_takes_use_real_shared_transcription_receipts_and_attempt_publication() {
    let (url, server, _gate) = server(3);
    let (_dir, app, session, item) = fixture(takes(3), &url);
    listen(app.clone(), session.clone(), "continuous-fixture".into()).await;
    server.join().unwrap();
    let status = session.status.lock().unwrap();
    assert!(!status.listening && !status.processing && status.queued == 0);
    assert!(status.failure.is_none(), "{:?}", status.failure);
    assert_eq!(status.completed, 3);
    assert!(app.capture.lock().unwrap().is_none());
    let store = app.lock().unwrap();
    let page = store.drill_attempts(&item, None, 10).unwrap();
    assert_eq!(page.attempts.len(), 3);
    assert!(page.attempts.iter().all(|a| a.transcript == "Hola"));
    assert_eq!(store.profile().unwrap().global.attempts, 3);
    let receipts: i64 = store
        .connection
        .query_row(
            "SELECT count(*) FROM transcription_attempts WHERE drill_item_id=?1",
            [item],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(receipts, 3);
}
#[tokio::test]
async fn cancellation_discards_unaccepted_audio_without_dispatch() {
    let (_dir, app, session, item) = fixture(takes(3), "http://127.0.0.1:1/v1");
    session.stop.store(2, Ordering::SeqCst);
    listen(app.clone(), session.clone(), "continuous-fixture".into()).await;
    assert!(app.capture.lock().unwrap().is_none());
    assert!(
        app.lock()
            .unwrap()
            .drill_attempts(&item, None, 10)
            .unwrap()
            .attempts
            .is_empty()
    );
    assert_eq!(app.lock().unwrap().profile().unwrap().global.attempts, 0);
}
#[tokio::test]
async fn queue_saturation_stops_capture_and_finishes_only_accepted_takes() {
    let (url, server, gate) = server(3);
    gate.store(false, Ordering::SeqCst);
    let (_dir, app, session, item) = fixture(takes(5), &url);
    let worker = tokio::spawn(listen(
        app.clone(),
        session.clone(),
        "continuous-fixture".into(),
    ));
    let began = Instant::now();
    while session.status.lock().unwrap().listening {
        assert!(began.elapsed().as_secs() < 5);
        tokio::time::sleep(std::time::Duration::from_millis(10)).await;
    }
    gate.store(true, Ordering::SeqCst);
    worker.await.unwrap();
    server.join().unwrap();
    assert!(
        session
            .status
            .lock()
            .unwrap()
            .failure
            .as_ref()
            .unwrap()
            .message
            .contains("fell behind")
    );
    assert_eq!(
        app.lock()
            .unwrap()
            .drill_attempts(&item, None, 10)
            .unwrap()
            .attempts
            .len(),
        3
    );
    assert!(app.capture.lock().unwrap().is_none());
}

#[tokio::test]
async fn changed_visit_or_paused_execution_stops_before_transcription() {
    for change_visit in [false, true] {
        let (_dir, app, session, item) = fixture(takes(1), "http://127.0.0.1:1/v1");
        if change_visit {
            let mut store = app.lock().unwrap();
            let current = crate::drill::sessions::active_visit(&store.connection, &item).unwrap();
            store.leave_drill_visit(&current).unwrap();
        } else {
            app.lock()
                .unwrap()
                .connection
                .execute("UPDATE ai_config SET paused=1", [])
                .unwrap();
        }
        listen(app.clone(), session.clone(), "continuous-fixture".into()).await;
        assert!(session.status.lock().unwrap().failure.is_some());
        assert!(app.capture.lock().unwrap().is_none());
        assert_eq!(app.lock().unwrap().profile().unwrap().global.attempts, 0);
    }
}

#[tokio::test]
async fn expired_view_lease_discards_current_audio_and_releases_microphone() {
    let (_dir, app, session, _) = fixture(takes(1), "http://127.0.0.1:1/v1");
    *session.lease.lock().unwrap() = Instant::now() - std::time::Duration::from_secs(11);
    listen(app.clone(), session.clone(), "continuous-fixture".into()).await;
    assert!(
        session
            .status
            .lock()
            .unwrap()
            .failure
            .as_ref()
            .unwrap()
            .message
            .contains("disconnected")
    );
    assert!(app.capture.lock().unwrap().is_none());
    assert_eq!(app.lock().unwrap().profile().unwrap().global.attempts, 0);
}

#[tokio::test]
async fn browser_pcm_uses_the_same_detector_receipts_and_publication() {
    let (url, server, _gate) = server(1);
    let (_dir, app, session, item) = fixture(Vec::new(), &url);
    session.stop.store(0, Ordering::SeqCst);
    *session.browser.lock().unwrap() = Some(Default::default());
    let worker = tokio::spawn(listen(
        app.clone(),
        session.clone(),
        "continuous-fixture".into(),
    ));
    for (sequence, chunk) in takes(1).chunks(2048).enumerate() {
        session
            .browser
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .push(sequence as u32, 8000, chunk.to_vec())
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_millis(55)).await;
    }
    session.stop.store(1, Ordering::SeqCst);
    worker.await.unwrap();
    server.join().unwrap();
    let status = session.status.lock().unwrap();
    assert!(status.failure.is_none(), "{:?}", status.failure);
    assert_eq!(status.completed, 1);
    let store = app.lock().unwrap();
    let page = store.drill_attempts(&item, None, 10).unwrap();
    assert_eq!(page.attempts.len(), 1);
    assert_eq!(page.attempts[0].transcript, "Hola");
    assert_eq!(store.profile().unwrap().global.attempts, 1);
}

#[tokio::test]
async fn silence_timeout_releases_capture_and_finishes_already_queued_takes() {
    let (url, server, gate) = server(1);
    gate.store(false, Ordering::SeqCst);
    let mut pcm = takes(1);
    pcm.extend(vec![0.0; 8000 * 10]);
    let (_dir, app, session, item) = fixture(pcm, &url);
    session.stop.store(0, Ordering::SeqCst);
    let worker = tokio::spawn(listen(
        app.clone(),
        session.clone(),
        "continuous-fixture".into(),
    ));
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        while session.status.lock().unwrap().listening {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
    })
    .await
    .unwrap();
    assert!(app.capture.lock().unwrap().is_none());
    assert!(session.status.lock().unwrap().failure.is_none());
    gate.store(true, Ordering::SeqCst);
    worker.await.unwrap();
    server.join().unwrap();
    assert_eq!(
        app.lock()
            .unwrap()
            .drill_attempts(&item, None, 10)
            .unwrap()
            .attempts
            .len(),
        1
    );
}
