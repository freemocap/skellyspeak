use super::Completion;
use crate::model::{AppError, ErrorCode, Result};
use serde::Deserialize;
use std::sync::OnceLock;

fn emoji_pattern() -> &'static regex::Regex {
    static EMOJI: OnceLock<regex::Regex> = OnceLock::new();
    EMOJI.get_or_init(|| {
        regex::Regex::new(r"[\p{Emoji_Presentation}\p{Extended_Pictographic}\x{FE0F}\x{20E3}]")
            .expect("valid Unicode emoji policy")
    })
}

/// Remove whole emoji graphemes, including joiners, modifiers and flag tags.
/// Ordinary digits and script joiners in non-emoji graphemes remain unchanged.
pub fn strip_prose_emojis(text: &str) -> (String, usize) {
    use unicode_segmentation::UnicodeSegmentation;
    let mut removed = 0;
    let clean: String = text
        .graphemes(true)
        .filter(|grapheme| {
            if emoji_pattern().is_match(grapheme) {
                removed += 1;
                false
            } else {
                true
            }
        })
        .collect();
    if removed == 0 {
        (clean, 0)
    } else {
        (clean.trim().to_owned(), removed)
    }
}

pub fn validate_prose(text: &str) -> Result<()> {
    if text.trim().is_empty()
        || text.chars().count() > 12000
        || text.contains('\0')
        || emoji_pattern().is_match(text)
    {
        return Err(AppError::new(
            ErrorCode::Provider,
            "The reply failed the nonempty, length or emoji-free output contract. It was not saved to the conversation; any text that arrived is shown above.",
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
    let value: serde_json::Value = serde_json::from_slice(bytes).map_err(|e| {
        crate::diagnostics::response::invalid(
            "completion_json",
            "$",
            &format!(
                "JSON at line {} column {} ({:?})",
                e.line(),
                e.column(),
                e.classify()
            ),
            &serde_json::Value::Null,
        )
    })?;
    let invalid = |path: &str, expected: &str| {
        crate::diagnostics::response::invalid("completion", path, expected, &value)
    };
    let response: Response = serde_json::from_value(value.clone()).map_err(|_| {
        invalid(
            "$",
            "id, model, choices with finish_reason and message, optional numeric usage",
        )
    })?;
    if response.choices.len() != 1 {
        return Err(invalid("choices", "exactly one choice"));
    }
    if response.id.is_empty() {
        return Err(invalid("id", "nonempty request ID"));
    }
    if response.model.is_empty() {
        return Err(invalid("model", "nonempty model ID"));
    }
    let text = response.choices[0]
        .message
        .content
        .clone()
        .ok_or_else(|| invalid("choices[0].message.content", "string content"))?;
    let input_tokens = response.usage.as_ref().and_then(|u| u.prompt_tokens);
    let output_tokens = response.usage.as_ref().and_then(|u| u.completion_tokens);
    if input_tokens.is_some_and(|n| n < 0) || output_tokens.is_some_and(|n| n < 0) {
        return Err(invalid("usage", "nonnegative token counts"));
    }
    Ok(Completion {
        diagnostics: Some(crate::diagnostics::response::metadata(&value, &[])),
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
