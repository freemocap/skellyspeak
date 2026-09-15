use super::*;

#[test]
fn rejects_emoji_without_stripping_and_accepts_multilingual_text() {
    for text in ["Hola ☀", "Hello 👨‍👩‍👧", "🇫🇷", "1️⃣", "", " "] {
        assert!(validate_prose(text).is_err(), "{text}");
    }
    for text in [
        "¡Hola! ¿Cómo estás?",
        "مرحبا بك",
        "你好，今天怎么样？",
        "1 + 2 = 3",
    ] {
        validate_prose(text).unwrap();
    }
}
#[test]
fn preserves_usage_and_finish_reason_for_publication_validation() {
    let raw=br#"{"id":"request","model":"actual","choices":[{"finish_reason":"stop","message":{"content":"Hi"}}],"usage":{"prompt_tokens":11,"completion_tokens":2}}"#;
    let reply = decode(raw).unwrap();
    assert_eq!(reply.input_tokens, Some(11));
    assert_eq!(reply.actual_model, "actual");
    let truncated = decode(
        &String::from_utf8_lossy(raw)
            .replace("stop", "length")
            .into_bytes(),
    )
    .unwrap();
    assert_eq!(truncated.finish_reason, "length");
    assert_eq!(truncated.input_tokens, Some(11));
    assert!(decode(b"{}").is_err());
}
