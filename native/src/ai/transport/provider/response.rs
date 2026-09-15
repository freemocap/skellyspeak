use super::Completion;
use crate::model::{AppError, ErrorCode, Result};
use serde::Deserialize;
use std::sync::OnceLock;

pub fn validate_prose(text: &str) -> Result<()> {
    static EMOJI: OnceLock<regex::Regex> = OnceLock::new();
    let emoji = EMOJI.get_or_init(|| {
        regex::Regex::new(r"[\p{Emoji_Presentation}\p{Extended_Pictographic}\x{FE0F}\x{20E3}]")
            .expect("valid Unicode emoji policy")
    });
    if text.trim().is_empty()
        || text.chars().count() > 12000
        || text.contains('\0')
        || emoji.is_match(text)
    {
        return Err(AppError::new(
            ErrorCode::Provider,
            "The reply failed the nonempty, length or emoji-free output contract. No reply was published.",
        ));
    }
    Ok(())
}
#[derive(Deserialize)]
struct Response {
    id: String,
    model: String,
    choices: Vec<Choice>,
    usage: Option<Usage>,
}
#[derive(Deserialize)]
struct Choice {
    finish_reason: String,
    message: ResponseMessage,
}
#[derive(Deserialize)]
struct ResponseMessage {
    content: Option<String>,
}
#[derive(Deserialize)]
struct Usage {
    prompt_tokens: Option<i32>,
    completion_tokens: Option<i32>,
}
pub(super) fn malformed() -> AppError {
    AppError::new(
        ErrorCode::Provider,
        "The AI service returned an incomplete or malformed completion. Usage may have been incurred; no automatic retry was made.",
    )
}
pub fn decode(bytes: &[u8]) -> Result<Completion> {
    let response: Response = serde_json::from_slice(bytes).map_err(|_| malformed())?;
    if response.choices.len() != 1 || response.id.is_empty() || response.model.is_empty() {
        return Err(malformed());
    }
    let text = response.choices[0]
        .message
        .content
        .clone()
        .ok_or_else(malformed)?;
    let input_tokens = response.usage.as_ref().and_then(|u| u.prompt_tokens);
    let output_tokens = response.usage.as_ref().and_then(|u| u.completion_tokens);
    if input_tokens.is_some_and(|n| n < 0) || output_tokens.is_some_and(|n| n < 0) {
        return Err(malformed());
    }
    Ok(Completion {
        text,
        finish_reason: response.choices[0].finish_reason.clone(),
        actual_model: response.model,
        provider_id: response.id,
        input_tokens,
        output_tokens,
    })
}

#[cfg(test)]
#[path = "tests/response.rs"]
mod tests;
