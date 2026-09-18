//! Provider-neutral hosted/custom speech wire protocol. Direct adapters stay separate.
use crate::ai::audio::{SpeechInput, SpeechOutcome};
use crate::ai::connections::access::{ResolvedTarget, response_bytes};
use crate::ai::hosted;
use crate::model::{AppError, ConnectionRoute, ErrorCode, Result};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;

pub(in crate::ai) fn validate(input: &SpeechInput) -> Result<()> {
    if input.text.trim().is_empty() || input.text.len() > 16_384 || input.text.contains('\0') {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Speech requires source text within the audio input limit.",
        ));
    }
    Ok(())
}

#[derive(Deserialize)]
struct Usage {
    requested_model: String,
    actual_model: Option<String>,
    provider: String,
    request_id: Option<String>,
    cost_micros: Option<u64>,
}
#[derive(Deserialize)]
struct Response {
    version: u32,
    audio_base64: String,
    format: String,
    usage: Usage,
}

fn invalid() -> AppError {
    AppError::new(
        ErrorCode::UnknownOutcome,
        "Invalid or interrupted audio response. Processing may have incurred a charge. No automatic retry was made.",
    )
}

fn decode(bytes: &[u8], target: &ResolvedTarget, outcome: &mut SpeechOutcome) -> Result<Vec<u8>> {
    let value: Response = serde_json::from_slice(bytes).map_err(|_| invalid())?;
    if value.version != 1
        || value.format != "wav"
        || value.usage.requested_model != target.model
        || value.usage.provider.is_empty()
        || value.usage.provider.len() > 64
    {
        return Err(invalid());
    }
    outcome.actual_model = value.usage.actual_model;
    outcome.provider_id = value.usage.request_id;
    outcome.cost_micros = value.usage.cost_micros;
    let wav = STANDARD.decode(value.audio_base64).map_err(|_| invalid())?;
    if wav.len() > crate::speech::cache::AUDIO_LIMIT {
        return Err(invalid());
    }
    let reader = hound::WavReader::new(std::io::Cursor::new(&wav)).map_err(|_| invalid())?;
    let spec = reader.spec();
    if spec.channels != 1
        || spec.sample_rate != 24_000
        || spec.bits_per_sample != 16
        || spec.sample_format != hound::SampleFormat::Int
        || reader.duration() == 0
    {
        return Err(invalid());
    }
    // Fully consume samples so truncated PCM is not published.
    for sample in reader.into_samples::<i16>() {
        sample.map_err(|_| invalid())?;
    }
    outcome.finish_reason = Some("stop".into());
    Ok(wav)
}

pub(in crate::ai) async fn synthesize(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: &SpeechInput,
    install: &str,
) -> SpeechOutcome {
    let mut outcome = SpeechOutcome::empty();
    outcome.audio = async {
        validate(input)?;
        let mut request = client
            .post(&target.url)
            .json(&serde_json::json!({"model": target.model, "text": input.text}));
        if !key.is_empty() {
            request = request.bearer_auth(key);
        }
        if target.route == ConnectionRoute::Hosted {
            request = hosted::identity(request, install);
        }
        let response = request.send().await.map_err(|_| invalid())?;
        let status = response.status();
        let bytes = if !status.is_success()
            && (target.route == ConnectionRoute::Hosted
                || matches!(status.as_u16(), 400 | 422 | 502 | 503))
        {
            hosted::body(response).await
        } else {
            response_bytes(response, "Speech", target.route, 6 * 1024 * 1024).await
        }
        .map_err(|mut error| {
            if !status.is_client_error() {
                error.code = ErrorCode::UnknownOutcome;
            }
            error
        })?;
        decode(&bytes, target, &mut outcome)
    }
    .await;
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;
    fn target() -> ResolvedTarget {
        ResolvedTarget {
            route: ConnectionRoute::Custom,
            revision: 1,
            url: "http://localhost/v1/audio/speech".into(),
            model: "eleven_v3".into(),
            credential: None,
        }
    }
    fn body() -> serde_json::Value {
        let mut output = std::io::Cursor::new(Vec::new());
        {
            let mut writer = hound::WavWriter::new(
                &mut output,
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
        serde_json::json!({"version":1,"format":"wav","audio_base64":STANDARD.encode(output.into_inner()),
            "usage":{"requested_model":"eleven_v3","actual_model":null,"provider":"elevenlabs","request_id":"receipt","cost_micros":null,
                "allowance_micros":100,"allowance_basis":"estimate"}})
    }
    #[test]
    fn estimated_allowance_is_not_reported_as_actual_cost() {
        let mut outcome = SpeechOutcome::empty();
        let wav = decode(
            &serde_json::to_vec(&body()).unwrap(),
            &target(),
            &mut outcome,
        )
        .unwrap();
        assert!(wav.starts_with(b"RIFF"));
        assert_eq!(outcome.provider_id.as_deref(), Some("receipt"));
        assert_eq!(outcome.finish_reason.as_deref(), Some("stop"));
        assert!(outcome.cost_micros.is_none());
        assert!(outcome.input_tokens.is_none());
    }
    #[test]
    fn malformed_audio_retains_receipt_without_publication() {
        let mut value = body();
        value["audio_base64"] = serde_json::json!("YWJj");
        let mut outcome = SpeechOutcome::empty();
        assert!(
            decode(
                &serde_json::to_vec(&value).unwrap(),
                &target(),
                &mut outcome
            )
            .is_err()
        );
        assert_eq!(outcome.provider_id.as_deref(), Some("receipt"));
        value = body();
        value["usage"]["requested_model"] = serde_json::json!("wrong-model");
        assert!(
            decode(
                &serde_json::to_vec(&value).unwrap(),
                &target(),
                &mut outcome
            )
            .is_err()
        );
    }
    #[tokio::test]
    async fn sends_only_internal_request_with_server_token() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let mut target = target();
        target.url = format!("http://{}/v1/audio/speech", listener.local_addr().unwrap());
        let body = body().to_string();
        let worker = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(std::time::Duration::from_secs(5)))
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
            assert!(
                request
                    .to_lowercase()
                    .contains("authorization: bearer server-token")
            );
            let value: serde_json::Value =
                serde_json::from_str(request.split_once("\r\n\r\n").unwrap().1).unwrap();
            assert_eq!(
                value,
                serde_json::json!({"model":"eleven_v3","text":"നന്ദി"})
            );
            write!(
                socket,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            )
            .unwrap();
        });
        let outcome = synthesize(
            &crate::ai::transport::provider::client().unwrap(),
            &target,
            "server-token",
            &SpeechInput {
                text: "നന്ദി".into(),
                voice: "alloy".into(),
                language: "Malayalam".into(),
            },
            "install",
        )
        .await;
        worker.join().unwrap();
        assert!(outcome.audio.is_ok());
    }
}
