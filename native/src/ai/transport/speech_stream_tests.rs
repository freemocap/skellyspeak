use super::*;
use std::sync::Mutex;

fn records() -> Vec<Value> {
    vec![
        json!({"version":3,"seq":0,"type":"start","format":"pcm_s16le","sample_rate":24000,"channels":1}),
        json!({"version":3,"seq":1,"type":"audio","response":{"audio_base64":"AQACAA=="},"receipt":{"request_id":"partial-receipt"}}),
        json!({"version":3,"seq":2,"type":"complete","total_samples":2,"alignment":null,"usage":{"request_id":"receipt","cost_micros":null,"allowance_micros":10}}),
    ]
}

#[test]
fn fragmented_delivery_precedes_terminal_and_retains_usage() {
    let mut decoder = Decoder::default();
    let mut outcome = SpeechOutcome::empty();
    let audio = Mutex::new(Vec::new());
    let emit =
        |pcm: &[u8], _: Option<&crate::speech::alignment::SpeechAlignment>, _: &SpeechOutcome| {
            audio.lock().unwrap().extend_from_slice(pcm);
            Ok(())
        };
    for record in records().iter().take(2) {
        for byte in format!("{record}\n").bytes() {
            decoder.feed(&[byte], &mut outcome, &emit).unwrap();
        }
    }
    assert_eq!(*audio.lock().unwrap(), vec![1, 0, 2, 0]);
    assert_eq!(outcome.provider_id.as_deref(), Some("partial-receipt"));
    assert!(outcome.audio.is_err());
    decoder
        .feed(records()[2].to_string().as_bytes(), &mut outcome, &emit)
        .unwrap();
    let wav = decoder.finish(&mut outcome, &emit).unwrap();
    let reader = hound::WavReader::new(std::io::Cursor::new(wav)).unwrap();
    assert_eq!(
        reader
            .into_samples::<i16>()
            .map(|s| s.unwrap())
            .collect::<Vec<_>>(),
        vec![1, 2]
    );
    assert_eq!(outcome.provider_id.as_deref(), Some("receipt"));
    assert!(outcome.cost_micros.is_none());
}

#[test]
fn missing_terminal_reordered_offsets_and_trailing_records_fail_closed() {
    for mode in 0..6 {
        let mut records = records();
        match mode {
            0 => {
                records.pop();
            }
            1 => records[1]["response"]["audio_base64"] = json!(""),
            2 => records[1]["seq"] = json!(2),
            3 => records[2]["seq"] = json!(3),
            4 => records.push(records[2].clone()),
            _ => {
                records[2] = json!({"version":3,"seq":2,"type":"error","status":429,"provider_error":{"code":"rate_limit","request_id":"failure-id"}})
            }
        }
        let mut decoder = Decoder::default();
        let mut outcome = SpeechOutcome::empty();
        let bytes = records.iter().map(|v| format!("{v}\n")).collect::<String>();
        let result = decoder
            .feed(bytes.as_bytes(), &mut outcome, &|_, _, _| Ok(()))
            .and_then(|_| decoder.finish(&mut outcome, &|_, _, _| Ok(())));
        assert!(result.is_err(), "mode {mode}");
        assert_eq!(
            result.unwrap_err().diagnostics.unwrap()["automatic_retries"],
            json!([])
        );
    }
}

#[test]
fn frame_and_pcm_limits_are_enforced_before_delivery() {
    let mut decoder = Decoder::default();
    assert!(
        decoder
            .feed(
                &vec![b'x'; FRAME_LIMIT + 1],
                &mut SpeechOutcome::empty(),
                &|_, _, _| panic!("must not emit")
            )
            .is_err()
    );
    let mut values = records();
    values[1]["response"]["audio_base64"] = json!("AQ==");
    let mut decoder = Decoder::default();
    let wire = values.iter().map(|v| format!("{v}\n")).collect::<String>();
    assert!(
        decoder
            .feed(
                wire.as_bytes(),
                &mut SpeechOutcome::empty(),
                &|_, _, _| panic!("must not emit")
            )
            .is_err()
    );
}

#[tokio::test]
async fn real_http_delivers_audio_while_the_terminal_is_blocked() {
    use std::io::{Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let (release, wait) = std::sync::mpsc::channel();
    let worker = std::thread::spawn(move || {
        let (mut socket, _) = listener.accept().unwrap();
        socket
            .set_read_timeout(Some(std::time::Duration::from_secs(5)))
            .unwrap();
        let mut request = Vec::new();
        loop {
            let mut byte = [0];
            socket.read_exact(&mut byte).unwrap();
            request.push(byte[0]);
            if request.ends_with(b"\r\n\r\n") {
                break;
            }
        }
        let headers = String::from_utf8(request).unwrap().to_lowercase();
        assert!(headers.contains("accept: application/x-ndjson"));
        let length: usize = headers
            .lines()
            .find_map(|line| line.strip_prefix("content-length: "))
            .unwrap()
            .parse()
            .unwrap();
        let mut request = vec![0; length];
        socket.read_exact(&mut request).unwrap();
        let records = records();
        let prefix = format!("{}\n{}\n", records[0], records[1]);
        let tail = format!("{}\n", records[2]);
        write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: application/x-ndjson\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",prefix.len()+tail.len(),prefix).unwrap();
        socket.flush().unwrap();
        wait.recv_timeout(std::time::Duration::from_secs(5))
            .unwrap();
        socket.write_all(tail.as_bytes()).unwrap();
    });
    let target = crate::ai::connections::access::ResolvedTarget {
        audio_resolution: None,
        route: crate::model::ConnectionRoute::Custom,
        revision: 1,
        url: format!("http://{address}/v1/audio/speech"),
        model: "model".into(),
        credential: None,
    };
    let input = crate::ai::audio::SpeechInput {
        text: "Source text".into(),
        language_tag: "en".into(),
        language: "English".into(),
        voice: "unused".into(),
    };
    let (sent, received) = tokio::sync::oneshot::channel();
    let sent = Mutex::new(Some(sent));
    let emit =
        |pcm: &[u8], _: Option<&crate::speech::alignment::SpeechAlignment>, _: &SpeechOutcome| {
            assert_eq!(pcm, &[1, 0, 2, 0]);
            sent.lock().unwrap().take().unwrap().send(()).unwrap();
            Ok(())
        };
    let client = crate::ai::transport::provider::client().unwrap();
    let request = crate::ai::transport::service_audio::synthesize_stream(
        &client,
        &target,
        "",
        &input,
        "workspace",
        &emit,
    );
    tokio::pin!(request);
    tokio::select! {
        _ = received => {},
        _ = &mut request => panic!("completed before upstream released its terminal"),
        _ = tokio::time::sleep(std::time::Duration::from_secs(5)) => panic!("no early PCM delivery"),
    }
    release.send(()).unwrap();
    let outcome = request.await;
    worker.join().unwrap();
    assert!(outcome.audio.is_ok());
    assert_eq!(outcome.provider_id.as_deref(), Some("receipt"));
    assert!(outcome.cost_micros.is_none());
}

#[test]
fn completed_stream_alignment_survives_cache_and_reference_inspection() {
    use crate::speech::{
        alignment::SpeechAudio, analysis::audio_inspection, recording::owner::RecordingOwner,
    };
    let mut decoder = Decoder::new("one two");
    let mut outcome = SpeechOutcome::empty();
    let pcm = STANDARD.encode(vec![0u8; 4800]);
    let values = [
        records()[0].clone(),
        json!({"version":3,"seq":1,"type":"audio","response":{"audio_base64":pcm,"alignment":{
            "characters":["one "],"character_start_times_seconds":[0.0],"character_end_times_seconds":[0.1]}}}),
        json!({"version":3,"seq":2,"type":"audio","response":{"audio_base64":pcm,"alignment":{
            "characters":["two"],"character_start_times_seconds":[0.1],"character_end_times_seconds":[0.3]}}}),
        json!({"version":3,"seq":3,"type":"audio","response":{"audio_base64":pcm,"alignment":null}}),
        json!({"version":3,"seq":4,"type":"complete","usage":{}}),
    ];
    for value in values {
        decoder
            .feed(format!("{value}\n").as_bytes(), &mut outcome, &|_, _, _| {
                Ok(())
            })
            .unwrap();
    }
    let wav = decoder.finish(&mut outcome, &|_, _, _| Ok(())).unwrap();
    let saved = SpeechAudio::new(&wav, outcome.alignment);
    let replay = SpeechAudio::decode(&serde_json::to_vec(&saved).unwrap()).unwrap();
    let (mut inspection, _) = audio_inspection::inspect_wav(
        &replay.wav().unwrap(),
        "reference",
        &RecordingOwner::DrillItem("fixture".into()),
    )
    .unwrap();
    let words = replay
        .alignment
        .unwrap()
        .words(inspection.duration)
        .unwrap();
    audio_inspection::attach_words(&mut inspection, Some(&words));
    assert_eq!(inspection.word_timing.words.len(), 2);
    assert_eq!(inspection.word_timing.words[0].word, "one");
    assert_eq!(inspection.word_timing.words[1].word, "two");
    assert_eq!(inspection.word_timing.words[1].start, 0.1);
    assert_eq!(inspection.word_timing.words[1].end, 0.3);
}
