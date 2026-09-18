//! The service supplies a separately redacted provider reason, not its raw body.
use serde_json::Value;

pub(super) fn message(code: Option<&str>, body: Option<&Value>) -> Option<String> {
    let status = code?.strip_prefix("ELEVENLABS_HTTP_")?;
    if status.len() != 3 || !status.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let number: u16 = status.parse().ok()?;
    if !(400..=599).contains(&number) {
        return None;
    }
    let detail = body?.get("provider_error")?;
    let reason = detail.get("code")?.as_str()?;
    if reason.is_empty()
        || reason.len() > 64
        || !reason
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
    {
        return None;
    }
    let explanation = match detail.get("message") {
        None => String::new(),
        Some(value) => {
            let text = value.as_str()?;
            if text.chars().count() > 1024 || text.chars().any(char::is_control) {
                return None;
            }
            format!(": {}", text.trim().trim_end_matches('.'))
        }
    };
    Some(format!(
        "ElevenLabs HTTP {status} ({reason}){explanation}. Usage is unconfirmed; no automatic retry was made."
    ))
}

#[cfg(test)]
mod tests {
    use super::super::refusal_message;

    #[test]
    fn displays_provider_reason_instead_of_guessing_from_http_status() {
        let body = br#"{"code":"ELEVENLABS_HTTP_401","detail":"ignored raw detail","provider_error":{"code":"missing_permissions","message":"The API key is missing the permission text_to_speech."}}"#;
        let message = refusal_message(502, Some(body));
        assert!(message.contains("ElevenLabs HTTP 401 (missing_permissions)"));
        assert!(message.contains("missing the permission text_to_speech"));
        assert!(!message.contains("ignored raw"));
        assert!(!message.contains("model access"));
        assert!(message.contains("no automatic retry"));
        assert!(!refusal_message(401, Some(body)).contains("missing_permissions"));
    }

    #[test]
    fn malformed_provider_details_do_not_escape_the_boundary() {
        for detail in [
            serde_json::json!({"code":"bad code", "message":"private"}),
            serde_json::json!({"code":"missing_permissions", "message":"private\ncontrol"}),
            serde_json::json!({"code":"missing_permissions", "message":"x".repeat(1025)}),
            serde_json::json!({"code":"missing_permissions", "message":{}}),
        ] {
            let body = serde_json::to_vec(&serde_json::json!({
                "code":"ELEVENLABS_HTTP_401", "provider_error":detail,
            }))
            .unwrap();
            let message = refusal_message(502, Some(&body));
            assert!(message.contains("credentials or model access"));
            assert!(!message.contains("private"));
        }
    }
}
