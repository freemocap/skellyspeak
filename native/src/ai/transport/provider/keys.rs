use crate::model::{AppError, ErrorCode, Result};
use std::time::Duration;

pub fn validate_key_format(key: &str) -> Result<()> {
    if key.chars().any(char::is_whitespace) {
        return Err(AppError::new(
            ErrorCode::Validation,
            "API keys cannot contain spaces or line breaks.",
        ));
    }
    if key.len() < 10 || key.len() > 4096 || !key.bytes().all(|b| b.is_ascii_graphic()) {
        return Err(AppError::new(ErrorCode::Validation, "Invalid API key."));
    }
    Ok(())
}

pub async fn verify_key(client: &reqwest::Client, key: &str) -> Result<()> {
    verify_key_at(client, key, "https://openrouter.ai/api/v1/key").await
}

async fn verify_key_at(client: &reqwest::Client, key: &str, url: &str) -> Result<()> {
    validate_key_format(key)?;
    let mut response = client.get(url).bearer_auth(key)
        .timeout(Duration::from_secs(15)).send().await.map_err(|_| AppError::new(
            ErrorCode::Provider, "Could not reach OpenRouter to verify the key. Check your connection and try again.",
        ))?;
    if response.status().as_u16() != 200 {
        return Err(crate::diagnostics::response::http_error(
            response,
            "OpenRouter key verification",
            &[key],
        )
        .await);
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| key_response_error())? {
        if bytes.len() + chunk.len() > 65536 {
            return Err(key_response_error());
        }
        bytes.extend_from_slice(&chunk);
    }
    let value: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| key_response_error())?;
    if !value.get("data").is_some_and(|data| data.is_object()) {
        return Err(key_response_error());
    }
    Ok(())
}
fn key_response_error() -> AppError {
    AppError::new(
        ErrorCode::Provider,
        "OpenRouter returned an unreadable key verification response. The key has not been verified.",
    )
}

#[cfg(test)]
#[path = "tests/keys.rs"]
mod tests;
