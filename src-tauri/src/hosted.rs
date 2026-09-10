//! Sign-in to the hosted service.
//!
//! The app holds no OAuth client secret. It opens the SYSTEM browser at the
//! service's `/auth/start`, the service performs the Google exchange, and the
//! browser comes back to the app carrying a short-lived one-time code. The app
//! trades that code for a session token over HTTPS.
//!
//! The system browser is not a preference. Google refuses OAuth from embedded
//! webviews outright (`disallowed_useragent`), and this app's entire UI is one.
//!
//! Coming back into the app happens two different ways, because the platforms
//! offer nothing in common:
//!
//! * **Desktop** — a loopback listener on an ephemeral port (RFC 8252). Bound
//!   before the browser opens, so the port in the redirect is known to be ours.
//! * **Android** — a `skellyspeak://auth` deep link, delivered by the OS.
//!
//! The service accepts exactly those two shapes and nothing else; see
//! `validate_redirect_uri` in `server/auth.py`.

use crate::settings::HOSTED_BASE_URL;
use tauri_plugin_opener::OpenerExt;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// How long to wait for someone to finish signing in before giving up. Long
/// enough to find a password, short enough that an abandoned attempt does not
/// leave a listener bound forever.
const SIGN_IN_TIMEOUT: Duration = Duration::from_secs(300);

/// Who is signed in and what allowance is left. Mirrors `GET /v1/me`.
///
/// The allowance is money, not tokens: the service meters what OpenRouter
/// actually charged, because the price of a token varies about a hundredfold
/// across models. Tokens and turns come back as ESTIMATES derived from this
/// account's own usage so far — they are the readable form of the number, not
/// the number the limit is enforced against.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub email: String,
    pub name: String,
    /// US dollars.
    pub used_usd: f64,
    pub limit_usd: f64,
    pub remaining_usd: f64,
    /// Reporting only.
    pub tokens_today: u64,
    pub requests_today: u64,
    /// The API calls this estimate "turns"; each unit is one AI request.
    #[serde(rename(deserialize = "estimated_turns_remaining"))]
    pub estimated_requests_remaining: u64,
    pub estimated_tokens_remaining: u64,
    /// This account carries its own daily limit rather than the service
    /// default. Shown so an unusual allowance reads as deliberate.
    #[serde(default)]
    pub custom_limit: bool,
    pub resets: String,
}

#[test]
fn account_decodes_service_contract_and_exposes_request_estimate_to_ui() {
    let mut body = serde_json::json!({
        "email": "learner@example.com", "name": "Learner",
        "used_usd": 0.1, "limit_usd": 0.5, "remaining_usd": 0.4,
        "tokens_today": 100, "requests_today": 2,
        "estimated_turns_remaining": 8, "estimated_tokens_remaining": 400,
        "custom_limit": false, "resets": "00:00 UTC"
    });
    let account: Account = serde_json::from_value(body.clone()).unwrap();
    assert_eq!(account.estimated_requests_remaining, 8);
    let ui = serde_json::to_value(account).unwrap();
    assert_eq!(ui["estimated_requests_remaining"], 8);
    assert!(ui.get("estimated_turns_remaining").is_none());
    body.as_object_mut().unwrap().remove("estimated_turns_remaining");
    assert!(serde_json::from_value::<Account>(body).unwrap_err().to_string()
        .contains("estimated_turns_remaining"));
}

/// A session token and the address it belongs to.
pub struct Session {
    pub token: String,
    pub email: String,
}

/// What the app tells the service about itself.
///
/// Deliberately three things and no more: a random per-installation id, the
/// operating system, and the app version. Enough to answer "how many machines
/// does someone use, on what, running what" — which is what decides where
/// effort goes — without carrying anything that locates or identifies a
/// person. No IP address, no device name, no hardware or advertising id.
pub struct ClientInfo {
    pub install_id: String,
    pub platform: &'static str,
    pub version: &'static str,
}

impl ClientInfo {
    pub fn new(install_id: &str) -> Self {
        Self {
            install_id: install_id.to_string(),
            platform: std::env::consts::OS,
            version: env!("CARGO_PKG_VERSION"),
        }
    }
}

/// Header names the service reads to record a device. Kept together so the
/// two sides are easy to keep in step.
const INSTALL_HEADER: &str = "X-SkellySpeak-Install";
const PLATFORM_HEADER: &str = "X-SkellySpeak-Platform";
const VERSION_HEADER: &str = "X-SkellySpeak-Version";

/// An absolute URL on the service, given a path rooted at its origin. The
/// AI endpoints live under `/v1`; sign-in lives beside it, not under it.
fn service_url(path: &str) -> String {
    let origin = HOSTED_BASE_URL.trim_end_matches("/v1");
    format!("{origin}{path}")
}

/// The PKCE pair for one sign-in attempt (RFC 7636).
///
/// The redirect that carries the login code back is NOT a private channel: on
/// Android any app may register `skellyspeak://`, and on desktop the loopback
/// port is reachable by anything on the machine. The verifier never leaves this
/// process, so a code intercepted in transit cannot be exchanged for a session.
/// RFC 8252 §8.1 requires this for native apps.
struct Pkce {
    verifier: String,
    challenge: String,
}

impl Pkce {
    fn new() -> Self {
        use base64::Engine;
        use sha2::{Digest, Sha256};
        // 32 random bytes base64url-encoded is 43 characters — the minimum the
        // RFC allows and 256 bits of entropy.
        let mut raw = [0u8; 32];
        getrandom::fill(&mut raw).expect("the OS must provide random bytes");
        let verifier = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(raw);
        let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(Sha256::digest(verifier.as_bytes()));
        Self { verifier, challenge }
    }
}

/// Where the browser is sent to begin sign-in.
fn start_url(redirect_uri: &str, challenge: &str) -> Result<String, String> {
    reqwest::Url::parse_with_params(
        &service_url("/auth/start"),
        &[
            ("provider", "google"),
            ("redirect_uri", redirect_uri),
            ("code_challenge", challenge),
            ("code_challenge_method", "S256"),
            ("app_state", challenge),
        ],
    )
    .map(String::from)
    .map_err(|e| format!("could not build the sign-in URL: {e}"))
}

/// Send the system browser to `url`.
///
/// This goes through the plugin instance on the AppHandle, NOT the crate-level
/// `open_url` free function. That free function is desktop-only in effect: it
/// spawns a helper program (`xdg-open` and friends), which does not exist on
/// Android, so it fails there with "No such file or directory (os error 2)".
/// The plugin instance dispatches to an ACTION_VIEW intent on Android and to
/// the same helper on desktop.
fn open_in_browser(app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| format!("could not open your browser to sign in: {e}"))
}

fn client() -> Result<reqwest::Client, String> {
    crate::network::client(30)
}

/// Pull `detail` out of a service response, so the reason the user sees is the
/// one the server actually gave rather than a bare status code.
async fn detail_of(response: reqwest::Response) -> String {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    serde_json::from_str::<serde_json::Value>(&body)
        .ok()
        .and_then(|v| v["detail"].as_str().map(str::to_string))
        .unwrap_or_else(|| format!("The hosted service returned {status}."))
}

/// Trade the one-time code for a session token, then read the account back so
/// the UI has an address to show for the session it just created.
async fn exchange(
    code: &str,
    verifier: &str,
    client_info: &ClientInfo,
) -> Result<Session, String> {
    let response = client()?
        .post(service_url("/auth/exchange"))
        .json(&serde_json::json!({ "code": code, "code_verifier": verifier }))
        .send()
        .await
        .map_err(|e| format!("could not reach the sign-in service: {e}"))?;
    if !response.status().is_success() {
        return Err(detail_of(response).await);
    }
    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("the sign-in service sent something unreadable: {e}"))?;
    let token = body["token"]
        .as_str()
        .filter(|t| !t.is_empty())
        .ok_or("The sign-in service returned no session token.")?
        .to_string();
    let email = account(&token, client_info).await?.email;
    Ok(Session { token, email })
}

/// Identity and remaining allowance for a session token.
///
/// Doubles as the device check-in: the service records the installation the
/// call came from, so this is what keeps "which machines" current rather than
/// frozen at whenever the person last signed in.
pub async fn account(token: &str, client_info: &ClientInfo) -> Result<Account, String> {
    let response = client()?
        .get(service_url("/v1/me"))
        .bearer_auth(token)
        .header(INSTALL_HEADER, &client_info.install_id)
        .header(PLATFORM_HEADER, client_info.platform)
        .header(VERSION_HEADER, client_info.version)
        .send()
        .await
        .map_err(|e| format!("could not reach the hosted service: {e}"))?;
    if !response.status().is_success() {
        return Err(detail_of(response).await);
    }
    let raw = response.bytes().await
        .map_err(|error| format!("could not read the hosted account response: {error}"))?;
    serde_json::from_slice::<Account>(&raw)
        .map_err(|error| format!("the hosted service sent an unreadable account: {error}"))
}

// ─── Desktop: loopback listener ──────────────────────────────────────────────

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub async fn sign_in(
    app: &tauri::AppHandle,
    client_info: &ClientInfo,
) -> Result<Session, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    // Bound before the browser opens, so the port named in the redirect is
    // provably the one we are listening on.
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("could not open a local port to receive the sign-in: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("could not read the local port: {e}"))?
        .port();
    // The literal address, not "localhost": that is what RFC 8252 specifies and
    // what the service's allowlist accepts.
    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    let pkce = Pkce::new();
    open_in_browser(app, &start_url(&redirect_uri, &pkce.challenge)?)?;

    let accept = async {
        loop {
            let (mut stream, _) = listener
                .accept()
                .await
                .map_err(|e| format!("the sign-in listener failed: {e}"))?;

            let mut buffer = [0u8; 2048];
            let read = match tokio::time::timeout(Duration::from_secs(3), stream.read(&mut buffer)).await {
                Ok(Ok(read)) => read,
                Ok(Err(error)) => return Err(format!("could not read the sign-in response: {error}")),
                Err(_) => continue,
            };
            let request = String::from_utf8_lossy(&buffer[..read]).to_string();

            // Browsers ask for /favicon.ico alongside the real request; that is
            // not the callback, so keep listening rather than failing.
            let Some(target) = request
                .lines()
                .next()
                .and_then(|line| line.split_whitespace().nth(1))
            else {
                continue;
            };
            if !request.starts_with("GET ") || target.split('?').next() != Some("/callback") {
                let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\n\r\n").await;
                continue;
            }

            let callback = reqwest::Url::parse(&format!("http://127.0.0.1:{port}{target}"))
                .map_err(|_| "Malformed sign-in callback".to_string())?;
            if !matches_state(&callback, &pkce.challenge) { continue; }
            let outcome = code_from_url(&callback);
            let page = match &outcome {
                Ok(_) => landing_page(
                    "Signed in",
                    "You can close this window and go back to SkellySpeak.",
                ),
                Err(reason) => landing_page("Sign-in failed", reason),
            };
            let _ = stream.write_all(page.as_bytes()).await;
            let _ = stream.flush().await;
            return outcome;
        }
    };

    let code = tokio::time::timeout(SIGN_IN_TIMEOUT, accept)
        .await
        .map_err(|_| "Sign-in timed out. Try again.".to_string())??;
    exchange(&code, &pkce.verifier, client_info).await
}

/// The `code` parameter from a callback request target such as
/// `/callback?code=abc&state=xyz`.
fn matches_state(url: &reqwest::Url, expected: &str) -> bool {
    let states: Vec<_> = url.query_pairs().filter(|(key, _)| key == "state").collect();
    states.len() == 1 && states[0].1 == expected
}

/// The `code` a callback carries, or the reason there isn't one. Shared by
/// both platforms, because a deep link and a loopback request differ only in
/// how they arrive.
fn code_from_url(url: &reqwest::Url) -> Result<String, String> {
    if let Some((_, reason)) = url.query_pairs().find(|(k, _)| k == "error") {
        return Err(format!("Sign-in was refused: {reason}"));
    }
    let codes: Vec<_> = url.query_pairs().filter(|(key, _)| key == "code").collect();
    if codes.len() != 1 || codes[0].1.is_empty() {
        return Err("The sign-in response must carry exactly one nonempty code.".into());
    }
    Ok(codes[0].1.to_string())
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn landing_page(heading: &str, message: &str) -> String {
    let escape = |value: &str| value.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;").replace('\'', "&#39;");
    let heading = escape(heading);
    let message = escape(message);
    let body = format!(
        "<!doctype html><meta charset=\"utf-8\"><title>SkellySpeak</title>\
         <style>body{{background:#0c1420;color:#e8eef6;font:16px/1.6 system-ui,sans-serif;\
         display:grid;place-items:center;height:100vh;margin:0;text-align:center}}\
         h1{{font-size:1.3rem;margin:0 0 .5rem}}p{{opacity:.75;margin:0}}</style>\
         <div><h1>{heading}</h1><p>{message}</p></div>"
    );
    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
         Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

// ─── Android: deep link ──────────────────────────────────────────────────────

/// The sign-in attempt currently waiting for a redirect, if any.
#[cfg(any(target_os = "android", target_os = "ios"))]
fn awaiting_link() -> &'static std::sync::Mutex<Option<(String, tokio::sync::oneshot::Sender<String>)>> {
    static SLOT: std::sync::OnceLock<
        std::sync::Mutex<Option<(String, tokio::sync::oneshot::Sender<String>)>>,
    > = std::sync::OnceLock::new();
    SLOT.get_or_init(|| std::sync::Mutex::new(None))
}

/// Guards the one-time registration of the deep-link handler.
#[cfg(any(target_os = "android", target_os = "ios"))]
static DEEP_LINK_HANDLER: std::sync::OnceLock<()> = std::sync::OnceLock::new();

#[cfg(any(target_os = "android", target_os = "ios"))]
pub async fn sign_in(
    app: &tauri::AppHandle,
    client_info: &ClientInfo,
) -> Result<Session, String> {
    use tauri_plugin_deep_link::DeepLinkExt;

    let (sender, receiver) = tokio::sync::oneshot::channel::<String>();
    let pkce = Pkce::new();
    // Hand this attempt's sender to the one permanent handler, displacing any
    // left behind by an attempt that was abandoned or failed before the
    // browser opened. A sign-in that never completed must not be able to
    // swallow the redirect belonging to the next one.
    *awaiting_link().lock().unwrap_or_else(|p| p.into_inner()) = Some((pkce.challenge.clone(), sender));

    // Registered exactly once for the life of the process. Registering per
    // attempt accumulated a handler every time someone pressed the button,
    // each holding a sender whose receiver was already gone.
    DEEP_LINK_HANDLER.get_or_init(|| {
        app.deep_link().on_open_url(|event| {
            let Some(url) = event.urls().first().cloned() else {
                return;
            };
            let mut pending = awaiting_link().lock().expect("sign-in lock poisoned");
            let Some((state, _)) = pending.as_ref() else { return; };
            if url.scheme() != "skellyspeak" || url.host_str() != Some("auth")
                || !matches!(url.path(), "" | "/") || !url.username().is_empty()
                || url.password().is_some() || url.port().is_some() || !matches_state(&url, state) { return; }
            if let Some((_, sender)) = pending.take() {
                let _ = sender.send(url.to_string());
            }
        });
    });

    open_in_browser(app, &start_url("skellyspeak://auth", &pkce.challenge)?)?;

    let url = tokio::time::timeout(SIGN_IN_TIMEOUT, receiver)
        .await
        .map_err(|_| "Sign-in timed out. Try again.".to_string())?
        .map_err(|_| "The sign-in was cancelled.".to_string())?;

    let parsed = reqwest::Url::parse(&url)
        .map_err(|_| "The sign-in response was malformed.".to_string())?;
    let code = code_from_url(&parsed)?;
    exchange(&code, &pkce.verifier, client_info).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn callback_state_must_match_exactly_once() {
        for query in ["state=wrong", "code=abc", "state=expected&state=expected"] {
            let url = reqwest::Url::parse(&format!("skellyspeak://auth?{query}")).unwrap();
            assert!(!matches_state(&url, "expected"));
        }
        assert!(matches_state(&reqwest::Url::parse("skellyspeak://auth?state=expected&code=abc").unwrap(), "expected"));
        assert!(code_of("/callback?code=one&code=two").is_err());
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    #[test]
    fn callback_error_is_escaped_in_the_landing_page() {
        let page = landing_page("Failed", "<script>alert('x')</script>");
        assert!(!page.contains("<script>"));
        assert!(page.contains("&lt;script&gt;"));
    }

    #[test]
    fn sign_in_urls_sit_beside_the_ai_base_not_under_it() {
        assert!(service_url("/v1/me").ends_with("/v1/me"));
        assert!(service_url("/auth/exchange").ends_with("/auth/exchange"));
        // A token exchange posted to /v1/auth/exchange would 404 forever.
        assert!(!service_url("/auth/exchange").contains("/v1/"));
    }

    #[test]
    fn the_start_url_carries_an_encoded_redirect() {
        let url = start_url("http://127.0.0.1:53127/callback", "c".repeat(43).as_str()).unwrap();
        assert!(url.contains("provider=google"));
        // Encoded, or the service reads a truncated redirect and refuses it.
        assert!(url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A53127%2Fcallback"));
    }

    fn code_of(target: &str) -> Result<String, String> {
        let url = reqwest::Url::parse("http://127.0.0.1")
            .unwrap()
            .join(target)
            .unwrap();
        code_from_url(&url)
    }

    #[test]
    fn the_callback_code_is_read_and_bad_ones_are_refused() {
        assert_eq!(code_of("/callback?code=abc123").unwrap(), "abc123");
        assert_eq!(code_of("/callback?code=abc123&state=xyz").unwrap(), "abc123");
        // Google reporting a refusal must surface as that refusal, not as a
        // generic "no code" — the two need different responses from the user.
        assert!(code_of("/callback?error=access_denied")
            .unwrap_err()
            .contains("refused"));
        assert!(code_of("/callback").is_err());
        assert!(code_of("/callback?code=").is_err());
    }
}

#[cfg(test)]
mod pkce_tests {
    use super::*;

    #[test]
    fn the_challenge_is_the_base64url_sha256_of_the_verifier() {
        // RFC 7636 Appendix B, so this is checked against the spec rather than
        // against itself.
        use base64::Engine;
        use sha2::{Digest, Sha256};
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(Sha256::digest(verifier.as_bytes()));
        assert_eq!(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    #[test]
    fn a_generated_pair_satisfies_the_rfc_and_verifies() {
        use base64::Engine;
        use sha2::{Digest, Sha256};
        let pkce = Pkce::new();
        // RFC 7636 §4.1: 43-128 characters of unreserved ASCII.
        assert!((43..=128).contains(&pkce.verifier.len()));
        assert!(pkce
            .verifier
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "-._~".contains(c)));
        assert_eq!(pkce.challenge.len(), 43);
        let expected = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(Sha256::digest(pkce.verifier.as_bytes()));
        assert_eq!(pkce.challenge, expected);
    }

    #[test]
    fn every_attempt_gets_a_fresh_verifier() {
        // Reusing one would make interception of a single code permanently
        // useful rather than useless.
        let a = Pkce::new();
        let b = Pkce::new();
        assert_ne!(a.verifier, b.verifier);
        assert_ne!(a.challenge, b.challenge);
    }

    #[test]
    fn the_start_url_carries_the_challenge_and_names_s256() {
        let url = start_url("skellyspeak://auth", "abc").unwrap();
        assert!(url.contains("code_challenge=abc"));
        assert!(url.contains("code_challenge_method=S256"));
    }
}
