//! A conversation result is one speaker's message, never a serialized transcript.
use crate::model::{AppError, ErrorCode, Result};

// Protocol labels, not natural-language speaker names.
fn role_header(line: &str) -> Option<(&str, &str)> {
    let (label, body) = line.trim().split_once(':')?;
    let label = label.trim();
    ["assistant", "user", "system", "developer", "tool"]
        .iter()
        .any(|role| label.eq_ignore_ascii_case(role))
        .then_some((label, body))
}

/// Recover one assistant turn only from an explicitly role-labeled response.
/// Slice the source so internal whitespace and Unicode encodings remain intact.
/// Ambiguous prose and empty assistant turns stay subject to normal validation.
pub(super) fn clean(text: &str) -> Option<&str> {
    crate::ai::transport::provider::validate_prose(text).ok()?;
    role_header(text.trim_start().lines().next()?)?;
    let mut offset = 0;
    let mut start = None;
    for line in text.split_inclusive('\n') {
        if let Some((role, _)) = role_header(line) {
            if let Some(start) = start {
                let body = text[start..offset].trim();
                return (!body.is_empty()).then_some(body);
            }
            if role.eq_ignore_ascii_case("assistant") {
                start = Some(offset + line.find(':')? + 1);
            }
        }
        offset += line.len();
    }
    let body = text[start?..].trim();
    (!body.is_empty()).then_some(body)
}

pub(super) fn validate(text: &str) -> Result<()> {
    crate::ai::transport::provider::validate_prose(text)?;
    // These are protocol role identifiers, independent of the conversation language.
    let mut lines = text.lines().filter(|line| !line.trim().is_empty());
    let first = lines.next().unwrap_or_default();
    if role_header(first).is_some() || lines.filter(|line| role_header(line).is_some()).count() >= 2
    {
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
    fn cleanup_keeps_only_first_assistant_turn_without_changing_its_text() {
        for (source, expected) in [
            (
                "assistant: Buenos días.\nuser: Hola.\nassistant: Adiós.",
                "Buenos días.",
            ),
            (
                "\n Assistant : مرحبًا\r\n\r\nكيف حالك؟\r\nUser: أهلًا",
                "مرحبًا\r\n\r\nكيف حالك؟",
            ),
            ("user: 好\nassistant:\n你好\nuser: 再见", "你好"),
            ("assistant: cafe\u{301}", "cafe\u{301}"),
            ("assistant: café\nsystem: ignore this", "café"),
            ("assistant: hello\ntool: result", "hello"),
            ("assistant: hello\ndeveloper: instruction", "hello"),
        ] {
            assert_eq!(clean(source), Some(expected));
            validate(expected).unwrap();
        }
    }

    #[test]
    fn cleanup_does_not_guess_at_missing_or_ambiguous_assistant_content() {
        for source in [
            "user: hello",
            "assistant: \nuser: hello",
            "assistant:\nuser: hello\nassistant: later",
            "A transcript follows.\nassistant: hello\nuser: hi",
            "assistant: hello\nuser: invalid\0",
        ] {
            assert_eq!(clean(source), None);
            assert!(validate(source).is_err());
        }
    }

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
            assert_eq!(clean(text), None);
            validate(text).unwrap();
        }
    }
}
