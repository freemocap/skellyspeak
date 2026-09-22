//! Access transport. Provider request/response conversion lives in adapters.
use super::transcription_adapters::Adapter;
use crate::ai::audio::{TranscriptionLanguage, TranscriptionOutcome, TranscriptionRequest};
use crate::ai::connections::access::{ResolvedTarget, response_bytes};
use crate::ai::hosted;
use crate::model::{AppError, ConnectionRoute, ErrorCode, Result};
fn error(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}
fn adapter(target: &ResolvedTarget) -> Adapter {
    if target.route != ConnectionRoute::Openrouter {
        Adapter::Service
    } else if target.model == "scribe_v2" {
        Adapter::ElevenLabs
    } else {
        Adapter::Groq
    }
}
pub(in crate::ai) fn validate_language(
    target: &ResolvedTarget,
    language: &TranscriptionLanguage,
) -> Result<String> {
    adapter(target).language(language)
}
#[cfg(test)]
fn transcription_response(bytes: &[u8], verbose: bool) -> Result<TranscriptionOutcome> {
    (if verbose {
        Adapter::Groq
    } else {
        Adapter::Service
    })
    .decode(bytes, None)
}
#[cfg(test)]
fn test_language(tag: &str) -> TranscriptionLanguage {
    TranscriptionLanguage {
        language_id: tag.into(),
        variety_id: "default".into(),
        language_tag: tag.into(),
    }
}
pub(in crate::ai) async fn transcribe(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: TranscriptionRequest,
    install: &str,
) -> Result<TranscriptionOutcome> {
    let mut outcome = execute(client, target, key, input, install).await;
    let diagnostics = match &mut outcome {
        Ok(value) => &mut value.diagnostics,
        Err(error) => &mut error.diagnostics,
    };
    let metadata = diagnostics.get_or_insert_with(|| serde_json::json!({}));
    metadata["requested_model"] = serde_json::json!(target.model);
    match adapter(target) {
        Adapter::Groq => metadata["provider"] = serde_json::json!("groq"),
        Adapter::ElevenLabs => metadata["provider"] = serde_json::json!("elevenlabs"),
        Adapter::Service => {}
    }
    outcome
}

async fn execute(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: TranscriptionRequest,
    install: &str,
) -> Result<TranscriptionOutcome> {
    let adapter = adapter(target);
    let private_context = input.context.clone().unwrap_or_default();
    let wav = &input.wav;
    let duration = if adapter == Adapter::ElevenLabs {
        let reader = hound::WavReader::new(std::io::Cursor::new(wav))
            .map_err(|_| error("Invalid recording WAV."))?;
        Some(reader.duration() as f64 / f64::from(reader.spec().sample_rate))
    } else {
        None
    };
    if wav.is_empty() || wav.len() > 25 * 1024 * 1024 {
        return Err(error("Recording must contain audio and be at most 25 MB."));
    }
    let form = adapter.form(&target.model, input)?;
    let request = client.post(&target.url);
    let request = if key.is_empty() {
        request
    } else if adapter == Adapter::ElevenLabs {
        request.header("xi-api-key", key)
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
            if adapter == Adapter::ElevenLabs {
                "ElevenLabs transcription"
            } else {
                "Groq transcription"
            },
            &[key, &private_context],
        )
        .await);
    }
    let bytes = if target.route == ConnectionRoute::Hosted
        || (target.route == ConnectionRoute::Custom
            && matches!(status.as_u16(), 400 | 422 | 502 | 503))
    {
        hosted::body_with_private(response, &[key, &private_context]).await
    } else {
        response_bytes(response, "Transcription", target.route, 1_048_576).await
    }
    .map_err(|mut error| {
        if !status.is_client_error() {
            error.code = ErrorCode::UnknownOutcome;
        }
        error
    })?;
    let mut result = adapter.decode(&bytes, duration);
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
            TranscriptionRequest {
                wav: b"RIFF-test-audio".to_vec(),
                language: test_language("es"),
                context: Some("Spanish — Spain".into()),
            },
            "private-install-id",
        )
        .await
        .unwrap();
        assert_eq!(result.result.text, "Hola, ¿cómo estás?");
        assert!(result.result.timing.is_none());
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
            for language in [Some("es"), Some("ar")] {
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
                    TranscriptionRequest {
                        wav: b"RIFF-test".to_vec(),
                        language: test_language(language.unwrap()),
                        context: Some(hint.into()),
                    },
                    "fixture-install",
                )
                .await
                .unwrap();
                assert_eq!(response.result.text, "Hola");
                assert_eq!(response.result.timing.is_some(), verbose);
                worker.join().unwrap();
            }
        }
        assert!(
            transcription_response(br#"{"text":"Hola"}"#, true)
                .unwrap()
                .result
                .timing
                .is_none()
        );
    }
    #[test]
    fn text_only_transcription_preserves_script_without_fabricating_evidence() {
        let response =
            transcription_response("{\"text\":\"അത് നല്ലതാണ്.\"}".as_bytes(), false).unwrap();
        assert_eq!(response.result.text, "അത് നല്ലതാണ്.");
        assert!(response.result.timing.is_none());
        assert_eq!(
            transcription_response(br#"{"text":" "}"#, false)
                .unwrap()
                .result
                .text,
            " "
        );
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
        assert_eq!(result.result.timing.unwrap().words.len(), 1);
        value["timing"]["words"][0]["end"] = serde_json::json!(2.0);
        let out = transcription_response(&serde_json::to_vec(&value).unwrap(), false).unwrap();
        assert_eq!(out.result.text, "നമസ്കാരം");
        assert!(out.result.timing.is_none());
        value["timing"]["words"] = serde_json::json!([]);
        value["timing"]["text"] = serde_json::json!("different text");
        let out = transcription_response(&serde_json::to_vec(&value).unwrap(), false).unwrap();
        assert_eq!(out.result.text, "നമസ്കാരം");
        assert!(out.result.timing.is_none());
    }
}

#[cfg(test)]
mod scribe_http_tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    #[tokio::test]
    async fn direct_scribe_converts_language_auth_and_result_without_route_fallback() {
        for (tag, code) in [
            ("en-US", "en"),
            ("es-MX", "es"),
            ("ar-LB", "ar"),
            ("zh-Hans", "zh"),
        ] {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let target = ResolvedTarget {
                route: ConnectionRoute::Openrouter,
                revision: 1,
                url: format!("http://{}/speech-to-text", listener.local_addr().unwrap()),
                model: "scribe_v2".into(),
                credential: None,
            };
            let task = tokio::spawn(async move {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut bytes = Vec::new();
                loop {
                    let mut chunk = [0; 4096];
                    let n = socket.read(&mut chunk).await.unwrap();
                    assert!(n > 0);
                    bytes.extend_from_slice(&chunk[..n]);
                    if let Some(end) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                        let headers = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
                        let length: usize = headers
                            .lines()
                            .find_map(|l| l.strip_prefix("content-length:"))
                            .unwrap()
                            .trim()
                            .parse()
                            .unwrap();
                        if bytes.len() < end + 4 + length {
                            continue;
                        }
                        assert!(headers.contains("xi-api-key: fixture-key"));
                        assert!(!headers.contains("authorization:"));
                        let body = String::from_utf8_lossy(&bytes[end + 4..]);
                        assert!(body.contains(&format!("name=\"language_code\"\r\n\r\n{code}")));
                        assert!(body.contains("name=\"model_id\"\r\n\r\nscribe_v2"));
                        assert!(body.contains("name=\"no_verbatim\"\r\n\r\nfalse"));
                        assert!(!body.contains("private context"));
                        break;
                    }
                }
                let body = r#"{"text":"Hello","words":[{"type":"word","text":"Hello","start":0.1,"end":0.8}]}"#;
                socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nX-Request-ID: req-scribe\r\nConnection: close\r\n\r\n{body}",body.len()).as_bytes()).await.unwrap();
            });
            let mut wav = std::io::Cursor::new(Vec::new());
            {
                let mut writer = hound::WavWriter::new(
                    &mut wav,
                    hound::WavSpec {
                        channels: 1,
                        sample_rate: 16000,
                        bits_per_sample: 16,
                        sample_format: hound::SampleFormat::Int,
                    },
                )
                .unwrap();
                for _ in 0..16000 {
                    writer.write_sample(0i16).unwrap();
                }
                writer.finalize().unwrap();
            }
            let result = transcribe(
                &crate::ai::transport::provider::client().unwrap(),
                &target,
                "fixture-key",
                TranscriptionRequest {
                    wav: wav.into_inner(),
                    language: test_language(tag),
                    context: Some("private context".into()),
                },
                "install",
            )
            .await
            .unwrap();
            assert_eq!(result.result.text, "Hello");
            assert_eq!(result.result.timing.unwrap().duration, 1.0);
            let metadata = serde_json::to_string(&result.diagnostics).unwrap();
            assert!(metadata.contains("req-scribe"));
            assert!(!metadata.contains("Hello"));
            task.await.unwrap();
        }
    }
}
