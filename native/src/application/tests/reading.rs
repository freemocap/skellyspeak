use super::*;
use std::io::{Read, Write};

#[tokio::test]
async fn selected_word_reaches_speech_and_receipt_survives_without_source_content() {
    let directory = tempfile::tempdir().unwrap();
    let state = Application::start(&directory.path().join("reading.sqlite3"), None);
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}/v1", listener.local_addr().unwrap());
    let target = {
        let store = state.lock().unwrap();
        store.connection.execute("UPDATE ai_config SET route='custom',custom_config=json_set(custom_config,'$.baseUrl',?1,'$.bearerAuth',json('false'))", [&base]).unwrap();
        access::resolve(&store.connection, access::Capability::Speech).unwrap()
    };
    let mut wav = std::io::Cursor::new(Vec::new());
    {
        let mut writer = hound::WavWriter::new(
            &mut wav,
            hound::WavSpec {
                channels: 1,
                sample_rate: 24_000,
                bits_per_sample: 16,
                sample_format: hound::SampleFormat::Int,
            },
        )
        .unwrap();
        writer.write_sample(100_i16).unwrap();
        writer.finalize().unwrap();
    }
    let encoded_audio = STANDARD.encode(wav.into_inner());
    let body = serde_json::json!({"version":1,"format":"wav","audio_base64":encoded_audio,"usage":{"requested_model":target.model,"actual_model":"eleven_v3","provider":"elevenlabs","request_id":"speech-receipt","cost_micros":null,"allowance_micros":12}}).to_string();
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
            let text = String::from_utf8_lossy(&request);
            if let Some((headers, payload)) = text.split_once("\r\n\r\n") {
                let length: usize = headers
                    .lines()
                    .find_map(|line| {
                        line.to_lowercase()
                            .strip_prefix("content-length: ")
                            .and_then(|n| n.parse().ok())
                    })
                    .unwrap();
                if payload.len() >= length {
                    break;
                }
            }
        }
        let request = String::from_utf8(request).unwrap();
        assert!(request.starts_with("POST /v1/audio/speech"));
        let payload: serde_json::Value =
            serde_json::from_str(request.split_once("\r\n\r\n").unwrap().1).unwrap();
        assert_eq!(payload["text"], "كتاب");
        write!(
            socket,
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        )
        .unwrap();
    });
    let id = state
        .reading
        .begin(
            &state.lock().unwrap(),
            reading::ReadingInput {
                text: "كتاب".into(),
                language: "arabic".into(),
                variety: None,
                explanation: "english".into(),
                explanation_variety: None,
                speech: true,
            },
        )
        .unwrap();
    let result = run_owned_reading(&state, &id).await.unwrap();
    worker.join().unwrap();
    assert!(result.audio_base64.is_some());
    assert!(result.gloss.is_none());
    let receipts = reading::activity(&state.lock().unwrap()).unwrap();
    assert_eq!(receipts[0]["state"], "succeeded");
    assert_eq!(receipts[0]["response"]["providerId"], "speech-receipt");
    assert!(receipts[0]["response"]["costMicros"].is_null());
    assert!(!receipts[0].to_string().contains("كتاب"));
    assert!(!receipts[0].to_string().contains(&encoded_audio));
    assert!(state.reading.claim(&id).is_err());
}
