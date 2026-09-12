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

#[cfg(test)]
mod tests {
    use super::*;

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
