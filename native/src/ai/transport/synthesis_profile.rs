//! Effective service synthesis identity. No workflow or payload ownership.
use crate::ai::connections::access::{ResolvedTarget, response_bytes};
use crate::ai::hosted;
use crate::model::{AppError, ConnectionRoute, ErrorCode, Result};

pub(super) fn valid(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}

pub(in crate::ai) async fn fetch(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    install: &str,
) -> Result<String> {
    fetch_inner(client, target, key, install)
        .await
        .map_err(|mut error| {
            if error.code == ErrorCode::UnknownOutcome {
                error.code = ErrorCode::Provider;
                error.message =
                    "Could not read the service speech configuration. Synthesis was not submitted."
                        .into();
            }
            error
                .diagnostics
                .get_or_insert_with(|| serde_json::json!({}))["synthesis_submitted"] =
                serde_json::json!(false);
            error
        })
}

async fn fetch_inner(
    client: &reqwest::Client,
    target: &ResolvedTarget,
    key: &str,
    install: &str,
) -> Result<String> {
    let base = target.url.strip_suffix("/audio/speech").ok_or_else(|| {
        crate::model::AppError::new(
            crate::model::ErrorCode::Validation,
            "Invalid speech service endpoint.",
        )
    })?;
    let mut request = client.get(format!("{base}/protocol"));
    if !key.is_empty() {
        request = request.bearer_auth(key);
    }
    if target.route == ConnectionRoute::Hosted {
        request = hosted::identity(request, install);
    }
    let response = request.send().await.map_err(|e| {
        crate::diagnostics::response::network_context(
            &e,
            "synthesis_profile",
            AppError::new(
                ErrorCode::Provider,
                "Could not read the service speech configuration. Synthesis was not submitted.",
            ),
        )
    })?;
    let http = crate::diagnostics::response::headers(&response);
    let bytes = if response.status().is_success() {
        response_bytes(response, "Speech configuration", target.route, 32_768).await?
    } else {
        hosted::body_with_private(response, &[key]).await?
    };
    let value: serde_json::Value = serde_json::from_slice(&bytes).map_err(|_| {
        crate::diagnostics::response::invalid(
            "synthesis_profile",
            "$",
            "service protocol JSON",
            &serde_json::json!({"http":http}),
        )
    })?;
    decode(&value, &target.model, &http)
}

pub(in crate::ai) fn decode(
    value: &serde_json::Value,
    model: &str,
    http: &serde_json::Value,
) -> Result<String> {
    if value["protocol"] != "skellyspeak"
        || value["version"] != 1
        || value["audio"]["speech_model"] != model
        || !value["audio"]["synthesis_profile"]
            .as_str()
            .is_some_and(valid)
    {
        // Retain only the known protocol fields; arbitrary protocol content is not diagnostics.
        return Err(crate::diagnostics::response::invalid(
            "synthesis_profile",
            "audio.synthesis_profile",
            "matching model and 64-character synthesis profile",
            &serde_json::json!({"http":http,
                "requested_model":model, "actual_model":value["audio"]["speech_model"]}),
        ));
    }
    Ok(value["audio"]["synthesis_profile"]
        .as_str()
        .unwrap()
        .to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_has_a_bounded_opaque_shape() {
        assert!(valid(&"a".repeat(64)));
        for value in [
            "",
            "voice-name",
            &"a".repeat(63),
            &"a".repeat(65),
            &"Z".repeat(64),
        ] {
            assert!(!valid(value));
        }
    }

    #[tokio::test]
    async fn incompatible_protocol_stops_before_synthesis() {
        use std::io::{Read, Write};
        for audio in [
            serde_json::json!({"speech_model":"model"}),
            serde_json::json!({"speech_model":"different","synthesis_profile":"a".repeat(64)}),
            serde_json::json!({"speech_model":"model","synthesis_profile":"invalid"}),
        ] {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let target = ResolvedTarget {
                route: ConnectionRoute::Custom,
                revision: 1,
                url: format!("http://{}/v1/audio/speech", listener.local_addr().unwrap()),
                model: "model".into(),
                credential: None,
            };
            let worker = std::thread::spawn(move || {
                let (mut socket, _) = listener.accept().unwrap();
                socket
                    .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                    .unwrap();
                let mut headers = Vec::new();
                while !headers.ends_with(b"\r\n\r\n") {
                    let mut byte = [0];
                    socket.read_exact(&mut byte).unwrap();
                    headers.push(byte[0]);
                }
                assert!(String::from_utf8_lossy(&headers).starts_with("GET /v1/protocol "));
                let body = serde_json::json!({"protocol":"skellyspeak","version":1,"audio":audio})
                    .to_string();
                write!(socket, "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nx-request-id: profile-fixture\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
            });
            let outcome = crate::ai::transport::service_audio::synthesize(
                &crate::ai::transport::provider::client().unwrap(),
                &target,
                "",
                &crate::ai::audio::SpeechInput {
                    text: "source".into(),
                    language: "language".into(),
                    voice: "unused".into(),
                },
                "install",
            )
            .await;
            worker.join().unwrap();
            let diagnostic = outcome.audio.unwrap_err().diagnostics.unwrap().to_string();
            assert!(diagnostic.contains("synthesis_profile"));
            assert!(diagnostic.contains("profile-fixture"));
        }
    }
}
