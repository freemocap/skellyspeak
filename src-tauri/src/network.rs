//! Transport policy and errors that never include provider response bodies or URLs.

pub fn validate_endpoint(value: &str) -> Result<(), String> {
    let url = reqwest::Url::parse(value).map_err(|_| "Server address must be an absolute HTTP(S) URL.")?;
    let loopback = url.host_str().is_some_and(|host| {
        host == "localhost" || host.trim_matches(['[', ']']).parse::<std::net::IpAddr>().is_ok_and(|ip| ip.is_loopback())
    });
    if url.host_str().is_none() || (url.scheme() != "https" && !(url.scheme() == "http" && loopback)) {
        return Err("Remote servers require HTTPS. HTTP is permitted only on loopback addresses.".into());
    }
    if !url.username().is_empty() || url.password().is_some() || url.query().is_some() || url.fragment().is_some() {
        return Err("Server addresses cannot contain credentials, query parameters, or fragments.".into());
    }
    Ok(())
}

pub fn client(seconds: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(seconds))
        .redirect(reqwest::redirect::Policy::none())
        .build().map_err(|_| "Could not create the HTTP client.".into())
}


pub fn provider_error(status: reqwest::StatusCode) -> String {
    let reason = match status.as_u16() {
        401 | 403 => "Authorization rejected. Check your sign-in or API key.",
        402 => "Provider credit limit reached.",
        429 => "Request or spending limit reached. Check your allowance before retrying.",
        400 | 422 => "Provider rejected the request. Check the selected model and settings.",
        _ => "Provider request failed.",
    };
    format!("API error {status}: {reason}")
}

fn hosted_error(status: reqwest::StatusCode, body: &serde_json::Value) -> String {
    let reason = match body["code"].as_str() {
        Some("PERSONAL_ALLOWANCE_EXHAUSTED") => "Your remaining daily allowance cannot cover this request, including pending reservations and unresolved charges. Check your allowance before resuming.",
        Some("SHARED_ALLOWANCE_EXHAUSTED") => "The shared hosted allowance cannot cover this request, including pending reservations and unresolved charges. Contact the service operator.",
        Some("SPENDING_PAUSED") => "Hosted spending is paused for a billing investigation. Contact the service operator.",
        Some("INGRESS_RATE_LIMIT") => "Too many requests in a short period. Wait a minute before resuming.",
        _ => return provider_error(status),
    };
    let mut message = format!("API error {status}: {reason}");
    if let Some(id) = body["request_id"].as_str().filter(|id| id.len() == 32 && id.bytes().all(|c| c.is_ascii_hexdigit())) {
        message.push_str(&format!(" Request ID: {id}"));
    }
    message
}

pub async fn response_error(response: reqwest::Response) -> String {
    let status = response.status();
    if !response.url().as_str().starts_with(&format!("{}/", crate::settings::HOSTED_BASE_URL)) {
        return provider_error(status);
    }
    match response_json(response, 4096).await {
        Ok(body) => hosted_error(status, &body),
        Err(error) => format!("{} Error details could not be read: {error}", provider_error(status)),
    }
}


pub async fn response_json(response: reqwest::Response, limit: usize) -> Result<serde_json::Value, String> {
    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| "Provider response was interrupted.")?;
        if bytes.len() + chunk.len() > limit { return Err("Provider response exceeds byte limit.".into()); }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| "Provider returned invalid JSON.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hosted_allowance_errors_preserve_safe_reason_and_identity_only() {
        let body = serde_json::json!({"code": "PERSONAL_ALLOWANCE_EXHAUSTED", "request_id": "a".repeat(32), "detail": "PRIVATE_TRANSCRIPT"});
        let message = hosted_error(reqwest::StatusCode::TOO_MANY_REQUESTS, &body);
        assert!(message.contains("pending reservations"));
        assert!(message.contains(&"a".repeat(32)));
        assert!(!message.contains("PRIVATE"));
        let malformed = serde_json::json!({"code": "INGRESS_RATE_LIMIT", "request_id": "PRIVATE"});
        let message = hosted_error(reqwest::StatusCode::TOO_MANY_REQUESTS, &malformed);
        assert!(message.contains("Wait a minute"));
        assert!(!message.contains("PRIVATE"));
    }

    #[test]
    fn custom_transport_rejects_cleartext_remote_and_embedded_credentials() {
        for address in ["http://example.com/v1", "http://127.0.0.1.example.com/v1", "file:///tmp/key",
            "https://user:secret@example.com/v1", "https://example.com/v1?key=secret", "https://example.com/#secret"] {
            assert!(validate_endpoint(address).is_err(), "{address}");
        }
        for address in ["https://example.com/v1", "http://127.0.0.1:11434/v1", "http://[::1]:11434/v1", "http://localhost:11434/v1"] {
            validate_endpoint(address).unwrap();
        }
    }
}
