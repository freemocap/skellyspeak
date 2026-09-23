use super::Completion;
use crate::model::{AppError, ErrorCode, Result};
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
    if text.trim().is_empty() || text.chars().count() > 12000 || text.contains('\0') {
        return Err(AppError::new(
            ErrorCode::Provider,
            "The reply failed the nonempty or bounded text contract. It was not saved to the conversation; any text that arrived is shown above.",
        ));
    }
    Ok(())
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
    // OpenRouter can report an upstream refusal inside an HTTP 200 completion.
    // Keep it a provider failure, rather than a downstream gloss/schema failure.
    if let Some(error) = value.pointer("/choices/0/error").filter(|v| !v.is_null())
        && value["choices"]
            .as_array()
            .is_some_and(|choices| choices.len() == 1)
        && value["choices"][0]["finish_reason"] == "error"
        && value
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .is_none_or(str::is_empty)
    {
        let safe = crate::diagnostics::response::metadata(error, &[]);
        let reason = crate::diagnostics::response::reason(&safe)
            .unwrap_or("No readable provider reason was supplied.");
        return Err(AppError::new(ErrorCode::Provider, format!("AI provider error: {reason}"))
            .with_diagnostics(serde_json::json!({
                "stage": "provider_completion", "response": crate::diagnostics::response::metadata(&value, &[]),
                "chars": value.pointer("/choices/0/message/content").and_then(|v| v.as_str()).map_or(0, |s| s.chars().count()),
            })));
    }
    let choice = value["choices"]
        .as_array()
        .and_then(|choices| choices.first())
        .ok_or_else(|| invalid("choices", "at least one choice with content"))?;
    let text = choice["message"]["content"]
        .as_str()
        .ok_or_else(|| invalid("choices[0].message.content", "string content"))?
        .to_owned();
    // Request identity, usage and termination labels describe the result; they
    // are not prerequisites for publishing usable content. Keep their raw
    // redacted metadata even when a typed reporting field is unavailable.
    let mut unavailable = Vec::new();
    let mut string = |field: &str, raw: &serde_json::Value| {
        raw.as_str()
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| {
                unavailable.push(field.to_owned());
                String::new()
            })
    };
    let actual_model = string("model", &value["model"]);
    let provider_id = string("id", &value["id"]);
    let finish_reason = string("finish_reason", &choice["finish_reason"]);
    let mut tokens = |field: &str| {
        let raw = &value["usage"][field];
        let count = raw
            .as_i64()
            .filter(|n| *n >= 0)
            .and_then(|n| i32::try_from(n).ok());
        if count.is_none() {
            unavailable.push(field.to_owned());
        }
        count
    };
    let input_tokens = tokens("prompt_tokens");
    let output_tokens = tokens("completion_tokens");
    let mut diagnostics = crate::diagnostics::response::metadata(&value, &[]);
    diagnostics["metadata_unavailable"] = serde_json::json!(unavailable);
    Ok(Completion {
        diagnostics: Some(diagnostics),
        text,
        finish_reason,
        actual_model,
        provider_id,
        input_tokens,
        output_tokens,
    })
}

#[cfg(test)]
#[path = "tests/response.rs"]
mod tests;
