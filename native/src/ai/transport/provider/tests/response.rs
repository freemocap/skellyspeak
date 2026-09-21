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

#[test]
fn strips_complete_emoji_sequences_without_damaging_language_text() {
    for emoji in [
        "🏛️🎻🌿",
        "👨‍👩‍👧",
        "👍🏽",
        "🇫🇷",
        "1️⃣",
        "#️⃣",
        "🏴\u{e0067}\u{e0062}\u{e007f}",
    ] {
        let (clean, removed) = strip_prose_emojis(&format!("{emoji}\n\nمرحبا 123"));
        assert_eq!(clean, "مرحبا 123", "{emoji}");
        assert!(removed > 0);
        validate_prose(&clean).unwrap();
    }
    let text = "  नमस्ते فارسی می‌خواهم 1 + 2 = 3 # * 你好  ";
    assert_eq!(strip_prose_emojis(text), (text.to_owned(), 0));
    assert!(validate_prose(&strip_prose_emojis("🎻").0).is_err());
    assert!(validate_prose(&strip_prose_emojis("Hello\0🎻").0).is_err());
    assert!(validate_prose(&strip_prose_emojis(&"a".repeat(12001)).0).is_err());
}

#[test]
fn embedded_rate_limit_preserves_provider_metadata_without_content() {
    let raw = serde_json::json!({"id":"request-429","model":"actual","choices":[{"finish_reason":"error","error":{"code":429,"message":"temporarily rate limited"},"message":{"content":"","reasoning":"private reasoning"}}],"usage":{"prompt_tokens":0,"completion_tokens":0,"cost":0}});
    let error = decode(&serde_json::to_vec(&raw).unwrap()).unwrap_err();
    assert!(error.message.contains("temporarily rate limited"));
    let details = error.diagnostics.unwrap();
    assert_eq!(details["chars"], 0);
    assert_eq!(details["response"]["id"], "request-429");
    assert_eq!(details["response"]["choices"][0]["error"]["code"], 429);
    assert_eq!(details["response"]["usage"]["cost"], 0);
    assert!(!details.to_string().contains("private reasoning"));
}

#[test]
fn error_after_partial_content_keeps_text_for_inspection_without_retry_classification() {
    let raw = serde_json::json!({"id":"partial","model":"actual","choices":[{"finish_reason":"error","error":{"code":429,"message":"limited"},"message":{"content":"Partial response"}}],"usage":{"prompt_tokens":10,"completion_tokens":2}});
    let completion = decode(&serde_json::to_vec(&raw).unwrap()).unwrap();
    assert_eq!(completion.text, "Partial response");
    assert_eq!(completion.finish_reason, "error");
    assert_eq!(completion.output_tokens, Some(2));
    assert_eq!(
        completion.diagnostics.unwrap()["choices"][0]["error"]["code"],
        429
    );
}
