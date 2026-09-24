//! Connect configured speech policy to the existing access route. Language
//! preferences select models, never a different server or authentication identity.
use super::access::{self, Capability, ResolvedTarget};
use crate::configuration::{
    LanguageContext,
    speech::{Catalog, Task},
};
use crate::model::Result;
use rusqlite::Connection;

pub fn resolve(
    db: &Connection,
    capability: Capability,
    context: &LanguageContext,
) -> Result<ResolvedTarget> {
    let mut target = access::resolve(db, capability)?;
    let task = match capability {
        Capability::Chat => return Ok(target),
        Capability::Transcription => Task::Transcription,
        Capability::Speech => Task::Speech,
    };
    let resolution = Catalog::bundled().resolve(
        task,
        context
            .external_tags
            .get("language_tag")
            .map(String::as_str)
            .unwrap_or_default(),
        &context.speech_routes,
        &target.model,
        None,
    )?;
    target.model = resolution.model.clone();
    target.audio_resolution = Some(resolution);
    Ok(target)
}

/// Read configured model availability, not provider health or recognition quality.
/// This does not submit learner content or invoke an inference provider.
pub async fn available(target: &ResolvedTarget, key: &str) -> Result<Vec<String>> {
    let base = target
        .url
        .rsplit_once("/audio/")
        .ok_or_else(|| {
            crate::model::AppError::new(
                crate::model::ErrorCode::Validation,
                "Invalid speech service destination.",
            )
        })?
        .0;
    let client = crate::ai::transport::provider::client()?;
    let mut request = client
        .get(format!("{base}/protocol"))
        .timeout(std::time::Duration::from_secs(15));
    if !key.is_empty() {
        request = request.bearer_auth(key);
    }
    let response = request
        .send()
        .await
        .map_err(|e| crate::diagnostics::response::network(&e, "speech_availability"))?;
    let bytes = crate::ai::hosted::body_with_private(response, &[key]).await?;
    let value: serde_json::Value = serde_json::from_slice(&bytes).map_err(|e| {
        crate::diagnostics::response::json_context(
            &e,
            "speech_availability",
            crate::model::AppError::new(
                crate::model::ErrorCode::Validation,
                "Invalid speech availability response.",
            ),
        )
    })?;
    decode_available(&value, &target.model)
}

fn decode_available(value: &serde_json::Value, default: &str) -> Result<Vec<String>> {
    let invalid = || {
        crate::diagnostics::response::invalid(
            "speech_availability",
            "audio.routing",
            "speech routing version 1 with available model IDs; update the SkellySpeak service",
            value,
        )
    };
    if value["protocol"] != "skellyspeak"
        || value["version"] != 1
        || value["audio"]["routing"]["version"] != 1
    {
        return Err(invalid());
    }
    let values = value["audio"]["routing"]["available_models"]
        .as_array()
        .filter(|v| v.len() <= 64)
        .ok_or_else(invalid)?;
    let mut models = Vec::new();
    for value in values {
        let id = value
            .as_str()
            .filter(|id| {
                !id.is_empty()
                    && id.len() <= 128
                    && id
                        .bytes()
                        .all(|c| c.is_ascii_alphanumeric() || b"_./-".contains(&c))
            })
            .ok_or_else(invalid)?;
        if models.iter().any(|v| v == id) {
            return Err(invalid());
        }
        models.push(id.to_owned());
    }
    if !Catalog::bundled().models.contains_key(default)
        && value["audio"]["routing"]["accepts_custom_transcription_models"] == true
    {
        models.push(default.into());
    }
    Ok(models)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn inventory_is_explicit_bounded_and_does_not_imply_custom_support() {
        let mut value = json!({"protocol":"skellyspeak","version":1,"audio":{"routing":{
            "version":1,"available_models":["scribe_v2"],"accepts_custom_transcription_models":false}}});
        assert_eq!(decode_available(&value, "custom").unwrap(), ["scribe_v2"]);
        value["audio"]["routing"]["accepts_custom_transcription_models"] = json!(true);
        assert_eq!(
            decode_available(&value, "custom").unwrap(),
            ["scribe_v2", "custom"]
        );
        for invalid in [
            json!(null),
            json!(["scribe_v2", "scribe_v2"]),
            json!(["https://private.invalid"]),
            json!([42]),
        ] {
            value["audio"]["routing"]["available_models"] = invalid;
            assert!(decode_available(&value, "whisper-large-v3").is_err());
        }
        assert!(
            decode_available(
                &json!({"protocol":"skellyspeak","version":1}),
                "whisper-large-v3"
            )
            .is_err()
        );
    }
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::model::ConnectionRoute;
    use std::io::{Read, Write};
    #[tokio::test]
    async fn configured_inventory_selects_before_capture_without_sending_learner_content() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/v1", listener.local_addr().unwrap());
        let target = ResolvedTarget {
            audio_resolution: None,
            route: ConnectionRoute::Custom,
            revision: 1,
            url: format!("{url}/audio/transcriptions"),
            model: "whisper-large-v3".into(),
            credential: None,
        };
        let worker = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(std::time::Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            let mut buf = [0u8; 1024];
            while !bytes.windows(4).any(|part| part == b"\r\n\r\n") {
                let size = stream.read(&mut buf).unwrap();
                assert!(size > 0);
                bytes.extend_from_slice(&buf[..size]);
            }
            let request = String::from_utf8(bytes).unwrap();
            assert!(request.starts_with("GET /v1/protocol "));
            assert!(!request.contains("PRIVATE_LEARNER_TEXT"));
            assert!(!request.to_lowercase().contains("authorization:"));
            let body = r#"{"protocol":"skellyspeak","version":1,"audio":{"routing":{"version":1,"available_models":["scribe_v2"],"accepts_custom_transcription_models":false}}}"#;
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            )
            .unwrap();
        });
        let inventory = available(&target, "").await.unwrap();
        let choice = Catalog::bundled()
            .resolve(
                Task::Transcription,
                "ga",
                &Default::default(),
                &target.model,
                Some(&inventory),
            )
            .unwrap();
        assert_eq!(choice.model, "scribe_v2");
        worker.join().unwrap();
    }
}
