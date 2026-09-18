//! Whisper-compatible file transcription adapter. No route selection or retries.
use crate::ai::audio::{TranscriptionInput, TranscriptionResponse};
use crate::ai::connections::access::{ResolvedTarget, response_bytes};
use crate::ai::hosted;
use crate::model::{AppError, ConnectionRoute, ErrorCode, Result};
use serde::Deserialize;
fn error(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}
fn transcription_form(
    target: &ResolvedTarget,
    wav: Vec<u8>,
    language: Option<&str>,
    variety_hint: &str,
) -> Result<reqwest::multipart::Form> {
    let verbose = target.route == ConnectionRoute::Openrouter;
    let mut form = reqwest::multipart::Form::new()
        .text("model", target.model.clone())
        .text(
            "response_format",
            if verbose { "verbose_json" } else { "json" },
        )
        .text("prompt", variety_hint.to_owned())
        .part(
            "file",
            reqwest::multipart::Part::bytes(wav)
                .file_name("audio.wav")
                .mime_str("audio/wav")
                .map_err(|_| error("Invalid audio type."))?,
        );
    if let Some(language) = language {
        form = form.text("language", language.to_owned());
    }
    if verbose {
        form = form
            .text("timestamp_granularities[]", "word")
            .text("timestamp_granularities[]", "segment");
    }
    Ok(form)
}
fn transcription_response(bytes: &[u8], verbose: bool) -> Result<TranscriptionResponse> {
    let value: serde_json::Value = serde_json::from_slice(bytes).map_err(|e| {
        crate::diagnostics::response::invalid(
            "transcription_json",
            "$",
            &format!("JSON at line {} column {}", e.line(), e.column()),
            &serde_json::Value::Null,
        )
    })?;
    let diagnostics = Some(crate::diagnostics::response::metadata(&value, &[]));
    let unknown = || {
        crate::diagnostics::response::invalid(
            "transcription",
            "timing",
            "matching text, finite duration and ordered word intervals within the recording",
            &value,
        )
    };
    let (text, verbose) = if verbose {
        let raw = std::str::from_utf8(bytes).map_err(|_| unknown())?;
        let parsed =
            crate::speech::analysis::fluency::parse_verbose_json(raw).map_err(|_| unknown())?;
        (parsed.text.clone(), Some(parsed))
    } else {
        #[derive(Deserialize)]
        struct Transcript {
            text: String,
            timing: Option<crate::speech::analysis::fluency::TranscriptTiming>,
        }
        let parsed: Transcript = serde_json::from_slice(bytes).map_err(|_| {
            crate::diagnostics::response::invalid(
                "transcription",
                "$",
                "text and optional timing object",
                &value,
            )
        })?;
        if let Some(timing) = parsed.timing {
            if timing.text != parsed.text
                || !timing.duration.is_finite()
                || !(0.0..=120.0).contains(&timing.duration)
            {
                return Err(unknown());
            }
            let mut previous = 0.0;
            for word in &timing.words {
                if !word.start.is_finite()
                    || !word.end.is_finite()
                    || word.start < previous
                    || word.end < word.start
                    || word.end > timing.duration
                    || word.word.trim().is_empty()
                {
                    return Err(unknown());
                }
                previous = word.start;
            }
            if parsed.text.trim().is_empty()
                || parsed.text.chars().count() > 20000
                || parsed.text.contains('\0')
            {
                return Err(unknown());
            }
            return Ok(TranscriptionResponse {
                diagnostics,
                text: parsed.text,
                timing: Some(timing),
                whisper_segments: None,
            });
        }
        (parsed.text, None)
    };
    if text.trim().is_empty() {
        return Err(error("No speech was recognized. Try another recording."));
    }
    if text.chars().count() > 20000 || text.contains('\0') {
        return Err(error("Transcription exceeds the message limits."));
    }
    let (timing, whisper_segments) = match verbose {
        Some(value) => (
            Some(crate::speech::analysis::fluency::TranscriptTiming {
                text: value.text,
                duration: value.duration,
                words: value.words,
            }),
            Some(value.segments),
        ),
        None => (None, None),
    };
    Ok(TranscriptionResponse {
        diagnostics,
        text,
        timing,
        whisper_segments,
    })
}
pub(in crate::ai) async fn transcribe(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: TranscriptionInput,
    install: &str,
) -> Result<TranscriptionResponse> {
    let TranscriptionInput {
        wav,
        language,
        variety_hint,
    } = input;
    if wav.is_empty() || wav.len() > 25 * 1024 * 1024 {
        return Err(error("Recording must contain audio and be at most 25 MB."));
    }
    let form = transcription_form(target, wav, language.as_deref(), &variety_hint)?;
    let request = client.post(&target.url);
    let request = if key.is_empty() {
        request
    } else {
        request.bearer_auth(key)
    };
    let request = if target.route == ConnectionRoute::Hosted {
        hosted::identity(request, install)
    } else {
        request
    };
    let response = request
        .multipart(form)
        .send()
        .await
        .map_err(|e| crate::diagnostics::response::network(&e, "transcription_request"))?;
    let http = crate::diagnostics::response::headers(&response);
    let status = response.status();
    if !status.is_success() && target.route == ConnectionRoute::Openrouter {
        return Err(crate::diagnostics::response::http_error(
            response,
            "Groq transcription",
            &[key, &variety_hint],
        )
        .await);
    }
    let bytes = if target.route == ConnectionRoute::Hosted
        || (target.route == ConnectionRoute::Custom
            && matches!(status.as_u16(), 400 | 422 | 502 | 503))
    {
        hosted::body_with_private(response, &[key, &variety_hint]).await
    } else {
        response_bytes(response, "Transcription", target.route, 1_048_576).await
    }
    .map_err(|mut error| {
        if !status.is_client_error() {
            error.code = ErrorCode::UnknownOutcome;
        }
        error
    })?;
    let mut result = transcription_response(&bytes, target.route == ConnectionRoute::Openrouter);
    match &mut result {
        Ok(value) => {
            value
                .diagnostics
                .get_or_insert_with(|| serde_json::json!({}))["http"] = http;
        }
        Err(error) => {
            error
                .diagnostics
                .get_or_insert_with(|| serde_json::json!({}))["http"] = http;
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::transport::provider;
    use std::time::Duration;
    #[tokio::test]
    async fn multipart_custom_transcription_sends_only_selected_auth_and_contract() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!(
            "http://{}/v1/audio/transcriptions",
            listener.local_addr().unwrap()
        );
        let worker = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            let mut buf = [0u8; 4096];
            let end = loop {
                let n = stream.read(&mut buf).unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buf[..n]);
                if let Some(i) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                    break i + 4;
                }
            };
            let headers = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
            let size: usize = headers
                .lines()
                .find_map(|l| l.strip_prefix("content-length:"))
                .unwrap()
                .trim()
                .parse()
                .unwrap();
            while bytes.len() < end + size {
                let n = stream.read(&mut buf).unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buf[..n]);
            }
            assert!(headers.starts_with("post /v1/audio/transcriptions "));
            assert!(!headers.contains("authorization:"));
            assert!(!headers.contains("x-skelly"));
            let body = String::from_utf8_lossy(&bytes[end..]);
            for expected in [
                "name=\"model\"",
                "custom-whisper",
                "name=\"language\"",
                "es",
                "Spanish — Spain",
                "name=\"prompt\"",
                "filename=\"audio.wav\"",
                "RIFF-test-audio",
            ] {
                assert!(body.contains(expected), "{expected}");
            }
            assert!(body.contains("name=\"response_format\"\r\n\r\njson"));
            assert!(!body.contains("timestamp_granularities"));
            let body = r#"{"text":"Hola, ¿cómo estás?"}"#;
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        });
        let target = ResolvedTarget {
            route: ConnectionRoute::Custom,
            revision: 1,
            url,
            model: "custom-whisper".into(),
            credential: None,
        };
        let result = transcribe(
            &provider::client().unwrap(),
            &target,
            "",
            TranscriptionInput {
                wav: b"RIFF-test-audio".to_vec(),
                language: Some("es".into()),
                variety_hint: "Spanish — Spain".into(),
            },
            "private-install-id",
        )
        .await
        .unwrap();
        assert_eq!(result.text, "Hola, ¿cómo estás?");
        assert!(result.timing.is_none());
        worker.join().unwrap();
    }
    #[tokio::test]
    async fn transcription_routes_explicitly_select_verbose_or_json_without_fallback() {
        use std::io::{Read, Write};
        for route in [
            ConnectionRoute::Openrouter,
            ConnectionRoute::Hosted,
            ConnectionRoute::Custom,
        ] {
            for language in [Some("es"), None] {
                let hint = if language.is_some() {
                    "Español"
                } else {
                    "Gaeilge"
                };
                let verbose = route == ConnectionRoute::Openrouter;
                let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
                let url = format!(
                    "http://{}/audio/transcriptions",
                    listener.local_addr().unwrap()
                );
                let worker = std::thread::spawn(move || {
                    let (mut stream, _) = listener.accept().unwrap();
                    stream
                        .set_read_timeout(Some(Duration::from_secs(5)))
                        .unwrap();
                    let mut bytes = vec![];
                    let mut buffer = [0; 4096];
                    let end = loop {
                        let count = stream.read(&mut buffer).unwrap();
                        assert!(count > 0);
                        bytes.extend_from_slice(&buffer[..count]);
                        if let Some(i) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                            break i + 4;
                        }
                    };
                    let headers = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
                    let size: usize = headers
                        .lines()
                        .find_map(|l| l.strip_prefix("content-length:"))
                        .unwrap()
                        .trim()
                        .parse()
                        .unwrap();
                    while bytes.len() < end + size {
                        let count = stream.read(&mut buffer).unwrap();
                        assert!(count > 0);
                        bytes.extend_from_slice(&buffer[..count]);
                    }
                    let body = String::from_utf8_lossy(&bytes[end..]);
                    assert_eq!(body.contains("name=\"language\""), language.is_some());
                    if let Some(language) = language {
                        assert!(body.contains(&format!("name=\"language\"\r\n\r\n{language}")));
                    }
                    assert!(body.contains(hint));
                    if verbose {
                        assert!(body.contains("name=\"response_format\"\r\n\r\nverbose_json"));
                        for value in ["word", "segment"] {
                            assert!(body.contains(&format!(
                                "name=\"timestamp_granularities[]\"\r\n\r\n{value}"
                            )));
                        }
                    } else {
                        assert!(body.contains("name=\"response_format\"\r\n\r\njson"));
                        assert!(!body.contains("timestamp_granularities"));
                    }
                    let response = if verbose {
                        r#"{"text":"Hola","duration":1,"words":[{"word":"Hola","start":0,"end":0.5}],"segments":[{"id":0,"start":0,"end":0.5,"text":"Hola","avg_logprob":-0.5,"no_speech_prob":0.1}],"x_groq":{"id":"metadata"}}"#
                    } else {
                        r#"{"text":"Hola"}"#
                    };
                    write!(
                    stream,
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response}",
                    response.len()
                )
                .unwrap();
                });
                let target = ResolvedTarget {
                    route,
                    revision: 1,
                    url,
                    model: "fixture".into(),
                    credential: None,
                };
                let response = transcribe(
                    &provider::client().unwrap(),
                    &target,
                    "",
                    TranscriptionInput {
                        wav: b"RIFF-test".to_vec(),
                        language: language.map(str::to_owned),
                        variety_hint: hint.into(),
                    },
                    "fixture-install",
                )
                .await
                .unwrap();
                assert_eq!(response.text, "Hola");
                assert_eq!(response.timing.is_some(), verbose);
                worker.join().unwrap();
            }
        }
        assert!(transcription_response(br#"{"text":"Hola"}"#, true).is_err());
    }
    #[test]
    fn text_only_transcription_preserves_script_without_fabricating_evidence() {
        let response =
            transcription_response("{\"text\":\"അത് നല്ലതാണ്.\"}".as_bytes(), false).unwrap();
        assert_eq!(response.text, "അത് നല്ലതാണ്.");
        assert!(response.timing.is_none());
        assert!(response.whisper_segments.is_none());
        assert!(transcription_response(br#"{"text":" "}"#, false).is_err());
        assert!(transcription_response(br#"{"error":"failure"}"#, false).is_err());
    }
}

#[cfg(test)]
mod service_timing_tests {
    use super::*;
    #[test]
    fn normalized_service_timing_preserves_text_and_rejects_invalid_evidence() {
        let mut value = serde_json::json!({"version":1,"text":"നമസ്കാരം","timing":{
            "text":"നമസ്കാരം","duration":1.0,"words":[{"word":"നമസ്കാരം","start":0.1,"end":0.9}]}});
        let result = transcription_response(&serde_json::to_vec(&value).unwrap(), false).unwrap();
        assert!(result.whisper_segments.is_none());
        assert_eq!(result.timing.unwrap().words.len(), 1);
        value["timing"]["words"][0]["end"] = serde_json::json!(2.0);
        assert!(transcription_response(&serde_json::to_vec(&value).unwrap(), false).is_err());
        value["timing"]["words"] = serde_json::json!([]);
        value["timing"]["text"] = serde_json::json!("different text");
        assert!(transcription_response(&serde_json::to_vec(&value).unwrap(), false).is_err());
    }
}
