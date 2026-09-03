//! Reachability checks for the keys a user supplies.

use serde::{Serialize};
use tauri::{State};
use crate::settings;
use crate::AppState;

// ─── API key validation ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct KeyStatus {
    pub valid: bool,
    pub detail: String,
}

/// Lightweight reachability check for an API key: OpenRouter's auth endpoint
/// for chat keys, Groq's model list for STT keys. Never logs or returns the
/// key itself.
#[tauri::command]
pub async fn validate_key(
    state: State<'_, AppState>,
    provider: String,
    key: String,
) -> Result<KeyStatus, String> {
    // A masked value from the UI means "validate the stored key".
    let mut key = key.trim().to_string();
    if key.contains('•') {
        let stored = state
            .settings
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone();
        key = match provider.as_str() {
            "openrouter" => stored.openrouter_key,
            "groq" => stored.groq_key,
            other => return Err(format!("unknown provider: {other}")),
        }
        .trim()
        .to_string();
    }
    if key.is_empty() {
        return Ok(KeyStatus {
            valid: false,
            detail: "no key entered".into(),
        });
    }
    let url = match provider.as_str() {
        "openrouter" => format!("{}/auth/key", settings::OPENROUTER_BASE_URL),
        "groq" => format!("{}/models", settings::GROQ_BASE_URL),
        other => return Err(format!("unknown provider: {other}")),
    };
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(url)
        .bearer_auth(&key)
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;
    let status = response.status();
    match status.as_u16() {
        200 => {
            let detail = if provider == "openrouter" {
                response
                    .json::<serde_json::Value>()
                    .await
                    .ok()
                    .and_then(|v| v["data"]["label"].as_str().map(str::to_string))
                    .unwrap_or_else(|| "key accepted".into())
            } else {
                "key accepted".into()
            };
            Ok(KeyStatus { valid: true, detail })
        }
        401 | 403 => Ok(KeyStatus {
            valid: false,
            detail: format!("key rejected ({status})"),
        }),
        s => Ok(KeyStatus {
            valid: false,
            detail: format!("unexpected status {s}"),
        }),
    }
}
