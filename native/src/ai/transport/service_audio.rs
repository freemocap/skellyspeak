//! Provider-neutral hosted/custom speech wire protocol.
use crate::ai::audio::{SpeechInput, SpeechOutcome};
use crate::ai::connections::access::{ResolvedTarget, response_bytes};
use crate::ai::hosted;
use crate::model::{AppError, ConnectionRoute, ErrorCode, Result};
use base64::{Engine, engine::general_purpose::STANDARD};
use serde::Deserialize;

pub(in crate::ai) fn validate(input: &SpeechInput) -> Result<()> {
    if input.text.trim().is_empty()
        || input.text.len() > 16_384
        || input.text.contains('\0')
        || input.language.trim().is_empty()
        || input.language.len() > 256
        || input
            .language
            .chars()
            .any(|c| c.is_control() || matches!(c, '[' | ']'))
    {
        return Err(AppError::new(
            ErrorCode::Validation,
            "Speech requires bounded source text and a valid language variety.",
        ));
    }
    Ok(())
}

#[derive(Deserialize)]
struct Response {
    version: u32,
    synthesis_profile: String,
    audio_base64: String,
    format: String,
}

fn decode(bytes: &[u8], profile: &str, outcome: &mut SpeechOutcome) -> Result<Vec<u8>> {
    let raw: serde_json::Value = serde_json::from_slice(bytes).map_err(|e| {
        crate::diagnostics::response::invalid(
            "speech_json",
            "$",
            &format!("JSON at line {} column {}", e.line(), e.column()),
            &serde_json::Value::Null,
        )
    })?;
    outcome.diagnostics = Some(crate::diagnostics::response::metadata(&raw, &[]));
    // Usage is observability, not an audio decoder prerequisite.
    outcome.actual_model = raw["usage"]["actual_model"].as_str().map(str::to_owned);
    outcome.provider_id = raw["usage"]["request_id"].as_str().map(str::to_owned);
    outcome.cost_micros = raw["usage"]["cost_micros"].as_u64();
    outcome.diagnostics.as_mut().unwrap()["metadata_unavailable"] = serde_json::json!({
        "actual_model": outcome.actual_model.is_none(), "request_id":outcome.provider_id.is_none(),
        "cost_micros":outcome.cost_micros.is_none()
    });
    let invalid = || {
        crate::diagnostics::response::invalid(
            "speech",
            "audio_base64",
            "complete mono 24 kHz 16-bit PCM WAV",
            &raw,
        )
    };
    let value: Response = serde_json::from_value(raw.clone()).map_err(|cause| {
        crate::diagnostics::response::json_context(
            &cause,
            "service_audio.rs_decode",
            crate::diagnostics::response::invalid(
                "speech",
                "$",
                "version, synthesis_profile, format and audio_base64",
                &raw,
            ),
        )
    })?;
    if value.version != 1 || value.format != "wav" {
        return Err(crate::diagnostics::response::invalid(
            "speech",
            "version/format",
            "version 1, wav",
            &raw,
        ));
    }
    if value.synthesis_profile != profile || !super::synthesis_profile::valid(profile) {
        return Err(crate::diagnostics::response::invalid(
            "speech",
            "synthesis_profile",
            "the requested effective synthesis profile",
            &raw,
        ));
    }
    outcome.synthesis_profile = Some(value.synthesis_profile);
    outcome.diagnostics.as_mut().unwrap()["synthesisProfile"] =
        serde_json::json!(outcome.synthesis_profile);
    let wav = STANDARD.decode(value.audio_base64).map_err(|cause| {
        crate::diagnostics::failures::base64(&cause, "speech_base64", invalid())
    })?;
    if wav.len() > crate::speech::delivery::AUDIO_LIMIT {
        return Err(invalid());
    }
    let reader = hound::WavReader::new(std::io::Cursor::new(&wav)).map_err(|cause| {
        crate::diagnostics::failures::wav(&cause, "speech_wav_header", invalid())
    })?;
    let spec = reader.spec();
    if spec.channels != 1
        || spec.sample_rate != 24_000
        || spec.bits_per_sample != 16
        || spec.sample_format != hound::SampleFormat::Int
        || reader.duration() == 0
    {
        return Err(invalid().with_diagnostics(serde_json::json!({"stage":"speech_wav_spec",
            "expected":"nonempty mono 24000 Hz 16-bit integer PCM", "channels":spec.channels,
            "sample_rate":spec.sample_rate,"bits_per_sample":spec.bits_per_sample,"duration_samples":reader.duration(),
            "format":format!("{:?}",spec.sample_format)})));
    }
    // Fully consume samples so truncated PCM is not published.
    for sample in reader.into_samples::<i16>() {
        sample.map_err(|cause| {
            crate::diagnostics::failures::wav(&cause, "speech_wav_samples", invalid())
        })?;
    }
    outcome.finish_reason = Some("stop".into());
    Ok(wav)
}

#[cfg(test)]
pub(in crate::ai) async fn synthesize(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: &SpeechInput,
    install: &str,
) -> SpeechOutcome {
    match super::synthesis_profile::fetch(client, target, key, install).await {
        Ok(profile) => synthesize_profiled(client, target, key, input, install, &profile).await,
        Err(error) => {
            let mut result = SpeechOutcome::empty();
            result.audio = Err(error);
            result
        }
    }
}

pub(in crate::ai) async fn synthesize_profiled(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    input: &SpeechInput,
    install: &str,
    profile: &str,
) -> SpeechOutcome {
    let mut outcome = SpeechOutcome::empty();
    outcome.audio = async {
        validate(input)?;
        let mut request = client
            .post(&target.url)
            .json(&serde_json::json!({"model": target.model, "text": input.text, "language": input.language, "synthesis_profile": profile}));
        if !key.is_empty() {
            request = request.bearer_auth(key);
        }
        if target.route == ConnectionRoute::Hosted {
            request = hosted::identity(request, install);
        }
        let response = request
            .send()
            .await
            .map_err(|e| crate::diagnostics::response::network(&e, "speech_request"))?;
        let http = crate::diagnostics::response::headers(&response);
        let status = response.status();
        let bytes = if !status.is_success()
            && (target.route == ConnectionRoute::Hosted
                || matches!(status.as_u16(), 400 | 409 | 422 | 502 | 503))
        {
            hosted::body_with_private(response, &[key, &input.text]).await
        } else {
            response_bytes(response, "Speech", target.route, 6 * 1024 * 1024).await
        }
        .map_err(|mut error| {
            if !status.is_client_error() {
                error.code = ErrorCode::UnknownOutcome;
            }
            error
        })?;
        let result = decode(&bytes, profile, &mut outcome);
        outcome
            .diagnostics
            .get_or_insert_with(|| serde_json::json!({}))["http"] = http;
        result
    }
    .await;
    outcome.diagnostics = outcome
        .diagnostics
        .as_ref()
        .map(|v| crate::diagnostics::response::metadata(v, &[key, &input.text]));
    if let Err(error) = &mut outcome.audio {
        error.message = crate::diagnostics::response::scrub(&error.message, &[key, &input.text]);
        error.diagnostics = error
            .diagnostics
            .as_ref()
            .map(|v| crate::diagnostics::response::metadata(v, &[key, &input.text]));
    }
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;
    const PROFILE: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
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
        serde_json::json!({"version":1,"synthesis_profile":PROFILE,"format":"wav","audio_base64":STANDARD.encode(output.into_inner()),
            "usage":{"requested_model":"eleven_v3","actual_model":null,"provider":"elevenlabs","request_id":"receipt","cost_micros":null,
                "allowance_micros":100,"allowance_basis":"estimate"}})
    }
    #[test]
    fn estimated_allowance_is_not_reported_as_actual_cost() {
        let mut outcome = SpeechOutcome::empty();
        let wav = decode(&serde_json::to_vec(&body()).unwrap(), PROFILE, &mut outcome).unwrap();
        assert!(wav.starts_with(b"RIFF"));
        assert_eq!(outcome.synthesis_profile.as_deref(), Some(PROFILE));
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
        assert!(decode(&serde_json::to_vec(&value).unwrap(), PROFILE, &mut outcome).is_err());
        assert_eq!(outcome.provider_id.as_deref(), Some("receipt"));
        value = body();
        value["usage"]["requested_model"] = serde_json::json!("wrong-model");
        assert!(decode(&serde_json::to_vec(&value).unwrap(), PROFILE, &mut outcome).is_ok());
    }
    #[test]
    fn profile_mismatch_retains_receipt_but_rejects_audio() {
        let mut value = body();
        value["synthesis_profile"] = serde_json::json!("b".repeat(64));
        let mut outcome = SpeechOutcome::empty();
        let error =
            decode(&serde_json::to_vec(&value).unwrap(), PROFILE, &mut outcome).unwrap_err();
        assert!(outcome.synthesis_profile.is_none());
        assert_eq!(outcome.provider_id.as_deref(), Some("receipt"));
        assert!(
            error
                .diagnostics
                .unwrap()
                .to_string()
                .contains("synthesis_profile")
        );
        value.as_object_mut().unwrap().remove("synthesis_profile");
        outcome = SpeechOutcome::empty();
        assert!(decode(&serde_json::to_vec(&value).unwrap(), PROFILE, &mut outcome).is_err());
        assert_eq!(outcome.provider_id.as_deref(), Some("receipt"));
    }
    #[test]
    fn playable_audio_does_not_require_a_complete_usage_receipt() {
        for usage in [
            serde_json::Value::Null,
            serde_json::json!("unavailable"),
            serde_json::json!({"requested_model":"different-model","cost_micros":"unknown"}),
        ] {
            let mut value = body();
            value["usage"] = usage;
            let mut outcome = SpeechOutcome::empty();
            assert!(decode(&serde_json::to_vec(&value).unwrap(), PROFILE, &mut outcome).is_ok());
            assert_eq!(outcome.cost_micros, None);
            assert_eq!(
                outcome.diagnostics.as_ref().unwrap()["metadata_unavailable"]["cost_micros"],
                true
            );
        }
    }
    #[tokio::test]
    async fn sends_only_internal_request_with_server_token() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let mut target = target();
        target.url = format!("http://{}/v1/audio/speech", listener.local_addr().unwrap());
        let body = body().to_string();
        let worker = std::thread::spawn(move || {
            let (mut probe, _) = listener.accept().unwrap();
            probe
                .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                .unwrap();
            let mut headers = Vec::new();
            while !headers.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                probe.read_exact(&mut byte).unwrap();
                headers.push(byte[0]);
            }
            assert!(String::from_utf8_lossy(&headers).starts_with("GET /v1/protocol "));
            let protocol = serde_json::json!({"protocol":"skellyspeak","version":1,
                "audio":{"speech_model":"eleven_v3","synthesis_profile":PROFILE}})
            .to_string();
            write!(
                probe,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                protocol.len(),
                protocol
            )
            .unwrap();
            drop(probe);
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
                serde_json::json!({"model":"eleven_v3","text":"Gracias.","language":"Spanish — Mexico","synthesis_profile":PROFILE})
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
                text: "Gracias.".into(),
                voice: "alloy".into(),
                language: "Spanish — Mexico".into(),
            },
            "install",
        )
        .await;
        worker.join().unwrap();
        assert!(outcome.audio.is_ok());
    }
}
