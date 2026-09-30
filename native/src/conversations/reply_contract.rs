//! A conversation result is one speaker's message, never a serialized transcript.
use crate::model::{AppError, ErrorCode, Result};

pub(super) fn validate(text: &str) -> Result<()> {
    crate::ai::transport::provider::validate_prose(text)?;
    // These are protocol role identifiers, independent of the conversation language.
    let role_header = |line: &str| {
        line.trim()
            .split_once(':')
            .map(|(label, _)| label.trim())
            .filter(|label| {
                ["assistant", "user", "system", "developer", "tool"]
                    .iter()
                    .any(|role| label.eq_ignore_ascii_case(role))
            })
            .is_some()
    };
    let mut lines = text.lines().filter(|line| !line.trim().is_empty());
    let first = lines.next().unwrap_or_default();
    if role_header(first) || lines.filter(|line| role_header(line)).count() >= 2 {
        return Err(AppError::new(
            ErrorCode::Provider,
            "The reply contained conversation role headers instead of one message. It was not saved to the conversation; the original response remains available for inspection.",
        )
        .with_diagnostics(serde_json::json!({
            "stage": "conversation_reply_validation",
            "path": "text",
            "reason": "role_labeled_transcript",
            "expected": "one speaker's message without protocol role headers",
        })));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn conversation_reply_rejects_protocol_transcripts_across_scripts() {
        for text in [
            "assistant: Buenos días.\n\nuser: Hola.",
            "  Assistant: مرحبًا\nUser: أهلًا",
            "assistant: cafe\u{301}",
            "A transcript follows.\nassistant: 你好\nuser: 好",
        ] {
            let error = validate(text).unwrap_err();
            assert_eq!(error.code, ErrorCode::Provider);
            assert_eq!(
                error.diagnostics.unwrap()["reason"],
                "role_labeled_transcript"
            );
        }
    }

    #[test]
    fn conversation_reply_preserves_ordinary_prose_and_quoted_role_words() {
        for text in [
            "Buenos días. ¿Cómo estás?",
            "مرحبا بك!",
            "你好，今天怎么样？",
            "Un cafe\u{301}, por favor.",
            "The word assistant: is a label in that example.",
            "She wrote ‘user: hello’ in her notes.",
            "Alice: Hello.\nBob: Hi.",
        ] {
            validate(text).unwrap();
        }
    }
}
