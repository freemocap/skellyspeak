//! Word interpretation is local; malformed timing never rewrites transcript text.
use crate::speech::analysis::fluency::{TranscriptTiming, Word, validate_timing};
use serde_json::{Value, json};

pub(super) fn decode(response: &Value, duration: f64) -> std::result::Result<Value, Value> {
    let failure = |path: String| {
        json!({"stage":"transcription_timing", "status":"unavailable",
        "reason":"invalid_provider_timing", "path":path, "expected":"ordered finite word intervals within recording duration"})
    };
    if response["words"].is_null() {
        return Ok(Value::Null);
    }
    let rows = response["words"]
        .as_array()
        .filter(|v| v.len() <= 20000)
        .ok_or_else(|| failure("words".into()))?;
    let mut words = Vec::new();
    for (index, row) in rows.iter().enumerate() {
        let path = format!("words[{index}]");
        if matches!(row["type"].as_str(), Some("spacing" | "audio_event")) {
            continue;
        }
        if row.get("type").is_some() && row["type"] != "word" {
            return Err(failure(path));
        }
        let word = row
            .get("word")
            .or_else(|| row.get("text"))
            .and_then(Value::as_str)
            .filter(|s| !s.trim().is_empty() && !s.contains('\0'))
            .ok_or_else(|| failure(path.clone()))?;
        words.push(Word {
            word: word.into(),
            start: row["start"].as_f64().ok_or_else(|| failure(path.clone()))?,
            end: row["end"].as_f64().ok_or_else(|| failure(path.clone()))?,
        });
    }
    let text = response["text"].as_str().unwrap_or_default();
    validate_timing(text, duration, &words).map_err(|_| failure("words".into()))?;
    if words.iter().any(|word| word.end > duration) {
        return Err(failure("words".into()));
    }
    Ok(serde_json::to_value(TranscriptTiming {
        text: text.into(),
        duration,
        words,
    })
    .unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn projects_both_word_schemas_without_rewriting_text() {
        for text in ["café", "cafe\u{301}", "مرحبا", "你好", "नमस्ते"] {
            for word in [
                json!({"word":text,"start":0.1,"end":0.9}),
                json!({"type":"word","text":text,"start":0.1,"end":0.9}),
            ] {
                let raw = json!({"text":text,"words":[word]});
                let result = decode(&raw, 1.0).unwrap();
                assert_eq!(result["text"], text);
                assert_eq!(result["words"][0]["word"], text);
            }
        }
        let raw = json!({"text":"a", "words":[{"type":"spacing","text":" "},
            {"type":"audio_event","text":"noise"},{"type":"word","text":"a","start":0.1,"end":0.5}]});
        assert_eq!(
            decode(&raw, 1.0).unwrap()["words"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn invalid_intervals_remain_unavailable_without_changing_transcript() {
        for (start, end) in [
            (json!(1.18), json!(1.82)),
            (json!(-0.01), json!(0.8)),
            (json!(0.8), json!(0.7)),
            (json!(true), json!(0.8)),
            (json!(0), Value::Null),
        ] {
            let raw = json!({"text":"private transcript","words":[{"word":"private","start":start,"end":end}]});
            let error = decode(&raw, 1.7626875).unwrap_err();
            assert_eq!(error["reason"], "invalid_provider_timing");
            assert!(!error.to_string().contains("private"));
            assert_eq!(raw["text"], "private transcript");
        }
        assert!(decode(&json!({"text":"a"}), 1.0).unwrap().is_null());
        assert!(decode(&json!({"text":"", "words":[]}), 1.0).is_ok());
    }
}
