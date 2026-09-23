//! Normalize declared recognition evidence already carried in service metadata.
//! [@groq_transcription_confidence] [@elevenlabs_transcription_confidence]
//! Language detection is not recognition confidence. Truncated lists are incomplete.
use serde_json::{Value, json};

pub(super) fn summary(value: &Value) -> Option<Value> {
    // Prefer the full-response summary: verbose diagnostic lists may be truncated.
    if let Some(summary) = value
        .get("transcription_confidence")
        .or_else(|| value.pointer("/usage/diagnostics/transcription_confidence"))
        .filter(|v| v.is_object())
    {
        let mut bounded = serde_json::Map::new();
        for key in [
            "score",
            "complete",
            "count",
            "no_speech_probability",
            "source",
        ] {
            if let Some(field) = summary.get(key).filter(|v| {
                v.is_number()
                    || v.is_boolean()
                    || v.is_null()
                    || (key == "source"
                        && matches!(v.as_str(), Some("word_logprobs" | "segment_logprobs")))
            }) {
                bounded.insert(key.into(), field.clone());
            }
        }
        return Some(Value::Object(bounded));
    }
    let response = value.pointer("/usage/diagnostics/response")?;
    let (rows, field, source, words) = if let Some(rows) = response["segments"].as_array() {
        (rows, "avg_logprob", "segment_logprobs", false)
    } else {
        let rows = response["words"].as_array()?;
        (rows, "logprob", "word_logprobs", true)
    };
    if rows.is_empty() || rows.len() > 10000 {
        return None;
    }
    let mut logs = Vec::new();
    let mut complete = true;
    let mut no_speech: Option<f64> = None;
    for row in rows {
        if !row.is_object() || row.get("truncated_items").is_some() {
            complete = false;
            continue;
        }
        if words {
            match row["type"].as_str() {
                Some("word") => {}
                Some("spacing" | "audio_event") => continue,
                _ => {
                    complete = false;
                    continue;
                }
            }
        }
        match row[field].as_f64().filter(|v| v.is_finite() && *v <= 0.0) {
            Some(value) => logs.push(value),
            None => complete = false,
        }
        if !words
            && let Some(value) = row["no_speech_prob"]
                .as_f64()
                .filter(|v| v.is_finite() && (0.0..=1.0).contains(v))
        {
            no_speech = Some(no_speech.map_or(value, |old| old.max(value)));
        }
    }
    complete &= !logs.is_empty();
    let score = complete.then(|| (logs.iter().sum::<f64>() / logs.len() as f64).exp());
    Some(
        json!({"score":score,"complete":complete,"count":logs.len(),"source":source,"no_speech_probability":no_speech}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_the_observed_service_response_path() {
        // Content-free shape and numeric evidence from the reported failing receipts.
        let value = json!({"usage":{"provider":"groq","diagnostics":{"response":{"segments":[
            {"avg_logprob":-0.05339829,"no_speech_prob":0.0012197495}
        ]}}}});
        let result = summary(&value).unwrap();
        assert!((result["score"].as_f64().unwrap() - 0.9480023574202364).abs() < 1e-8);
        assert_eq!(result["no_speech_probability"], 0.0012197495);
        assert_eq!(result["complete"], true);
    }
    #[test]
    fn incomplete_segments_cannot_claim_confidence() {
        for bad in [
            json!({"truncated_items":3}),
            json!({"avg_logprob":null}),
            json!({"avg_logprob":0.2}),
            json!({"avg_logprob":true}),
        ] {
            let value = json!({"usage":{"diagnostics":{"response":{"segments":[{"avg_logprob":-0.1},bad]}}}});
            let result = summary(&value).unwrap();
            assert_eq!(result["complete"], false);
            assert!(result["score"].is_null());
        }
    }
    #[test]
    fn reads_word_likelihood_without_using_language_probability_or_spacing() {
        let value = json!({"usage":{"diagnostics":{"response":{"language_probability":0.99,"words":[
            {"type":"word","logprob":-2.0},{"type":"spacing","logprob":0.0}
        ]}}}});
        let result = summary(&value).unwrap();
        assert_eq!(result["score"], (-2.0f64).exp());
        assert_eq!(result["count"], 1);
        assert_eq!(result["source"], "word_logprobs");
        assert!(
            summary(&json!({"usage":{"diagnostics":{"response":{"language_probability":0.99}}}}))
                .is_none()
        );
    }
}
