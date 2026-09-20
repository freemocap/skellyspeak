//! Bounded response metadata. Content and credentials never enter retained diagnostics.
use crate::model::{AppError, ErrorCode};
use serde_json::{Value, json};
use std::sync::OnceLock;

const LIMIT: usize = 16_384;
fn patterns() -> &'static Vec<regex::Regex> {
    static PATTERNS: OnceLock<Vec<regex::Regex>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        [
            r"(?s)-----BEGIN [^-]*PRIVATE KEY-----.*?(?:-----END [^-]*PRIVATE KEY-----|$)",
            r#"(?i)\b(?:authorization|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|token|cookie)["']?\s*[=:]\s*(?:(?:Bearer|Basic)\s+)?(?:"[^"]*"|'[^']*'|[^\s,;]+)"#,
            r#"(?i)\b(?:prompt|transcript|content|request body|response body|input|output)["']?\s*[=:]\s*[^\n]*"#,
            r"(?i)Bearer\s+[^\s,;<>]+",
            r"\b(?:sk-|gsk_)[A-Za-z0-9_-]+",
            r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",
            r#"https?://[^\s<>"']+"#,
            r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}",
            r"\b[A-Za-z0-9_-]{48,}\b",
        ]
        .into_iter()
        .map(|p| regex::Regex::new(p).expect("diagnostic pattern"))
        .collect()
    })
}
pub fn scrub(text: &str, private: &[&str]) -> String {
    let mut text = text.to_owned();
    let mut values = private.to_vec();
    values.sort_by_key(|v| std::cmp::Reverse(v.len()));
    for value in values {
        if !value.is_empty() {
            text = text.replace(value, "[redacted]");
        }
    }
    for pattern in patterns() {
        text = pattern.replace_all(&text, "[redacted]").into_owned();
    }
    static PROPERTY: OnceLock<regex::Regex> = OnceLock::new();
    text = PROPERTY
        .get_or_init(|| {
            regex::Regex::new(r#"\(reading ["']([A-Za-z_$][A-Za-z0-9_$]*)["']\)"#)
                .expect("property diagnostic")
        })
        .replace_all(&text, "(reading property $1)")
        .into_owned();
    static QUOTED: OnceLock<regex::Regex> = OnceLock::new();
    let quoted = QUOTED
        .get_or_init(|| regex::Regex::new(r#"["'`]([^"'`\n]*)["'`]"#).expect("quoted diagnostic"));
    text = quoted
        .replace_all(&text, |caps: &regex::Captures<'_>| {
            let value = &caps[1];
            // Preserve existing schema/permission identifiers, not quoted prose.
            if value
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"_/.-".contains(&b))
                && value.bytes().any(|b| b"_/.-".contains(&b))
            {
                caps[0].to_owned()
            } else {
                "[redacted: quoted value]".into()
            }
        })
        .into_owned();
    static CONTENT: OnceLock<regex::Regex> = OnceLock::new();
    text = CONTENT.get_or_init(|| regex::Regex::new(r"(?i)\b(prompt|transcript|content|request body|response body|input|output)\s*[=:]\s*[^\n]*").expect("content diagnostic"))
        .replace_all(&text, "$1=[redacted: content]").into_owned();
    let clean: String = text
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect();
    if clean.chars().count() > 2048 {
        format!(
            "{}[truncated: string limit]",
            clean.chars().take(2048).collect::<String>()
        )
    } else {
        clean
    }
}
fn content(key: &str) -> bool {
    matches!(
        key,
        "content"
            | "text"
            | "transcript"
            | "prompt"
            | "messages"
            | "input"
            | "output"
            | "audio"
            | "audio_base64"
            | "data"
            | "arguments"
            | "reasoning"
            | "reasoning_details"
            | "request"
            | "body"
            | "file"
            | "url"
            | "email"
            | "user_id"
            | "organization_id"
            | "authorization"
            | "api_key"
            | "key"
            | "token"
            | "password"
            | "secret"
    ) || [
        "secret",
        "password",
        "authorization",
        "api_key",
        "apikey",
        "access_token",
        "accesstoken",
        "refresh_token",
        "refreshtoken",
        "cookie",
    ]
    .iter()
    .any(|v| key.contains(v))
}
fn public_string(key: &str) -> bool {
    matches!(
        key,
        "type"
            | "code"
            | "status"
            | "param"
            | "id"
            | "request_id"
            | "x_request_id"
            | "processing_ms"
            | "openai_processing_ms"
            | "requestId"
            | "model"
            | "model_id"
            | "requested_model"
            | "actual_model"
            | "provider"
            | "provider_name"
            | "finish_reason"
            | "native_finish_reason"
            | "detected_language"
            | "language_code"
            | "format"
            | "cost_basis"
            | "allowance_basis"
            | "stage"
            | "reason"
            | "path"
            | "expected"
            | "exception_type"
            | "name"
            | "message"
            | "detail"
            | "error"
            | "stack"
            | "componentStack"
            | "redaction"
            | "source_file"
            | "function"
            | "retry_after"
            | "content_type"
    ) || key.starts_with("x_ratelimit_")
        || key.starts_with("ratelimit_")
}
pub fn metadata(value: &Value, private: &[&str]) -> Value {
    fn visit(v: &Value, field: &str, private: &[&str], depth: usize, budget: &mut usize) -> Value {
        if depth > 8 || *budget == 0 {
            return json!("[truncated: metadata limit]");
        }
        *budget -= 1;
        match v {
            Value::Object(map) => {
                let mut result = serde_json::Map::new();
                for (i, (key, value)) in map.iter().enumerate() {
                    if i == 64 {
                        result.insert("truncated_fields".into(), json!(map.len() - i));
                        break;
                    }
                    let safe_key = key.len() <= 64
                        && key
                            .bytes()
                            .all(|b| b.is_ascii_alphanumeric() || b"_.-".contains(&b))
                        && !private.contains(&key.as_str());
                    if !safe_key {
                        result.insert(
                            format!("redacted_field_{i}"),
                            json!("[redacted: field name]"),
                        );
                    } else {
                        result.insert(
                            key.clone(),
                            if content(&key.to_lowercase()) {
                                json!("[redacted: content or credential]")
                            } else {
                                visit(value, key, private, depth + 1, budget)
                            },
                        );
                    }
                }
                Value::Object(result)
            }
            Value::Array(items) => {
                let mut out: Vec<_> = items
                    .iter()
                    .take(32)
                    .map(|item| visit(item, field, private, depth + 1, budget))
                    .collect();
                if items.len() > 32 {
                    out.push(json!({"truncated_items":items.len()-32}));
                }
                json!(out)
            }
            Value::String(s) if s.starts_with("[redacted") || s.starts_with("[truncated") => {
                json!(s.chars().take(128).collect::<String>())
            }
            Value::String(s)
                if matches!(field, "id" | "request_id" | "x_request_id" | "requestId")
                    && s.len() <= 128
                    && s.bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b"_.-".contains(&b))
                    && !private.iter().any(|p| !p.is_empty() && s.contains(p))
                    && !["sk-", "gsk_", "eyJ"].iter().any(|p| s.starts_with(p)) =>
            {
                json!(s)
            }
            Value::String(s) if public_string(field) => json!(scrub(s, private)),
            Value::String(_) => json!("[redacted: unclassified string]"),
            _ => v.clone(),
        }
    }
    let result = visit(value, "", private, 0, &mut 512);
    if result.to_string().len() > LIMIT {
        let mut summary = serde_json::Map::new();
        summary.insert("reason".into(), json!("metadata_size_limit"));
        summary.insert("truncated".into(), json!(true));
        // A large metadata attachment must never erase the failure explanation.
        for key in [
            "name",
            "message",
            "stack",
            "componentStack",
            "code",
            "stage",
        ] {
            if let Some(Value::String(value)) = result.get(key) {
                summary.insert(key.into(), json!(scrub(value, private)));
            }
        }
        Value::Object(summary)
    } else {
        result
    }
}
pub fn reason(value: &Value) -> Option<&str> {
    for key in [
        "message",
        "detail",
        "error",
        "provider_error",
        "diagnostics",
    ] {
        if let Some(v) = value.get(key) {
            if let Some(s) = v
                .as_str()
                .filter(|s| !s.starts_with("[redacted") && !s.is_empty())
            {
                return Some(s);
            }
            if let Some(s) = reason(v) {
                return Some(s);
            }
        }
    }
    None
}
pub fn invalid(stage: &str, path: &str, expected: &str, value: &Value) -> AppError {
    AppError::new(
        ErrorCode::UnknownOutcome,
        format!(
            "Invalid {stage} response at {path}: expected {expected}. No automatic retry was made."
        ),
    )
    .with_diagnostics(
        json!({"stage":stage,"path":path,"expected":expected,"response":metadata(value, &[])}),
    )
}
pub fn network(error: &reqwest::Error, stage: &str) -> AppError {
    let reason = if error.is_timeout() {
        "timeout"
    } else if error.is_connect() {
        "connection_failed"
    } else if error.is_body() {
        "body_read_failed"
    } else if error.is_decode() {
        "decode_failed"
    } else {
        "transport_failed"
    };
    AppError::new(
        ErrorCode::UnknownOutcome,
        format!(
            "{stage}: {reason}. Provider processing may have occurred; no automatic retry was made."
        ),
    )
    .with_diagnostics(json!({"stage":stage,"reason":reason}))
}
pub async fn http_error(
    mut response: reqwest::Response,
    label: &str,
    private: &[&str],
) -> AppError {
    let status = response.status().as_u16();
    let refusal = (status == 429).then(|| crate::ai::policy::refusal::from_response(&response));
    let mut headers = serde_json::Map::new();
    for (key, value) in response.headers() {
        let name = key.as_str();
        if (matches!(
            name,
            "request-id"
                | "x-request-id"
                | "retry-after"
                | "content-type"
                | "processing-ms"
                | "openai-processing-ms"
        ) || name.starts_with("x-ratelimit-")
            || name.starts_with("ratelimit-"))
            && let Ok(value) = value.to_str()
        {
            headers.insert(
                name.replace('-', "_"),
                metadata(&json!({name.replace('-', "_"): value}), private)[name.replace('-', "_")]
                    .clone(),
            );
        }
    }
    let mut body = Vec::new();
    let mut truncated = false;
    let mut unreadable = false;
    loop {
        match response.chunk().await {
            Ok(Some(chunk)) if body.len() + chunk.len() <= LIMIT => body.extend_from_slice(&chunk),
            Ok(Some(_)) => {
                truncated = true;
                break;
            }
            Err(_) => {
                unreadable = true;
                break;
            }
            Ok(None) => break,
        }
    }
    let value = if truncated || unreadable {
        json!({"reason":"error_body_incomplete"})
    } else {
        serde_json::from_slice(&body).unwrap_or_else(
            |_| json!({"reason":"non_json_error_body","body":"[redacted: unstructured content]"}),
        )
    };
    let value = metadata(&value, private);
    let detail = reason(&value).unwrap_or("No readable provider reason was supplied.");
    let mut error = AppError::new(ErrorCode::Provider, format!("{label} HTTP {status}: {detail} No automatic retry was made."))
        .with_diagnostics(json!({"stage":"http","status":status,"response_headers":headers,"response":value,"truncated":truncated,"unreadable":unreadable}));
    error.refusal = refusal;
    error
}
pub fn column(row: &rusqlite::Row<'_>, index: usize) -> rusqlite::Result<Option<Value>> {
    row.get::<_, Option<String>>(index)?
        .map(|s| {
            serde_json::from_str(&s).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    index,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })
        })
        .transpose()
}

pub fn retained(success: Option<&Value>, error: Option<&AppError>) -> Option<String> {
    retained_with_private(success, error, &[])
}

pub fn retained_with_private(
    success: Option<&Value>,
    error: Option<&AppError>,
    private: &[&str],
) -> Option<String> {
    if success.is_none() && error.is_none() {
        return None;
    }
    Some(json!({"response":success,"error":error.map(|e| json!({"code":e.code,"message":scrub(&e.message, private),"diagnostics":e.diagnostics}))}).to_string())
}

pub fn headers(response: &reqwest::Response) -> Value {
    let mut kept = serde_json::Map::new();
    for (key, value) in response.headers() {
        let name = key.as_str();
        if (matches!(
            name,
            "request-id"
                | "x-request-id"
                | "retry-after"
                | "content-type"
                | "processing-ms"
                | "openai-processing-ms"
        ) || name.starts_with("x-ratelimit-")
            || name.starts_with("ratelimit-"))
            && let Ok(value) = value.to_str()
        {
            kept.insert(
                name.replace('-', "_"),
                metadata(&json!({name.replace('-', "_"): value}), &[])[name.replace('-', "_")]
                    .clone(),
            );
        }
    }
    kept.insert(
        "redacted_header_count".into(),
        json!(response.headers().len() - kept.len()),
    );
    json!({"status":response.status().as_u16(),"response_headers":kept})
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn metadata_limits_and_retained_failures_keep_the_error_explanation() {
        let mut value = json!({"message":"Language selection failed"});
        value["extra"] = json!(
            (0..32)
                .map(|_| json!({"message":"detail ".repeat(400)}))
                .collect::<Vec<_>>()
        );
        let result = metadata(&value, &[]);
        assert_eq!(result["message"], "Language selection failed");
        assert_eq!(result["truncated"], true);
        let error = AppError::new(
            ErrorCode::Internal,
            "Language selection failed; password=private-key",
        );
        let retained = retained(None, Some(&error)).unwrap();
        assert!(retained.contains("Language selection failed"));
        assert!(!retained.contains("private-key"));
    }
    #[test]
    fn retains_error_message_and_stack_while_redacting_sensitive_spans() {
        let result = metadata(
            &json!({
                "message":"Language picker failed: Maximum update depth exceeded; api_key=short-secret; transcript=private sentence",
                "stack":"at LearningPicker (src/features/settings/LanguagePickers.tsx:51:9)\nat render (assets/app.js:22:1)",
                "cause":{"message":"Permission denied", "code":"EACCES"},
                "request_id":"req-123", "prompt":"private prompt"
            }),
            &[],
        );
        assert!(
            result["message"]
                .as_str()
                .unwrap()
                .contains("Maximum update depth exceeded")
        );
        assert!(
            result["stack"]
                .as_str()
                .unwrap()
                .contains("LanguagePickers.tsx:51:9")
        );
        assert_eq!(result["cause"]["message"], "Permission denied");
        assert_eq!(result["request_id"], "req-123");
        for private in ["short-secret", "private sentence", "private prompt"] {
            assert!(!result.to_string().contains(private));
        }
        assert!(!scrub("Invalid token: Bearer abc123", &[]).contains("abc123"));
        assert!(!scrub("Parse failed near \"private text\"", &[]).contains("private text"));
    }
    #[test]
    fn keeps_identifiers_usage_and_extra_numbers_but_removes_content_and_keys() {
        let value = json!({"id":"provider-request", "model":"vendor/model", "usage":{"prompt_tokens":20,"cached_tokens":8},
            "extra":{"latency_ms":42,"new_text":"private unknown string"},
            "error":{"code":"missing_permissions","message":"Missing permission \"text_to_speech\". Echo private sentence arbitrary-key"},
            "choices":[{"finish_reason":"content_filter","message":{"content":"private answer"}}], "api_key":"arbitrary-key"});
        let out = metadata(&value, &["private sentence", "arbitrary-key"]);
        assert_eq!(out["id"], "provider-request");
        assert_eq!(out["usage"]["cached_tokens"], 8);
        assert_eq!(out["extra"]["latency_ms"], 42);
        assert_eq!(out["choices"][0]["finish_reason"], "content_filter");
        assert!(
            out["error"]["message"]
                .as_str()
                .unwrap()
                .contains("text_to_speech")
        );
        for secret in [
            "private sentence",
            "arbitrary-key",
            "private answer",
            "private unknown string",
        ] {
            assert!(!out.to_string().contains(secret));
        }
        assert!(
            out["extra"]["new_text"]
                .as_str()
                .unwrap()
                .contains("unclassified")
        );
    }
    #[test]
    fn malformed_completion_retains_partial_receipt_and_identifies_contract() {
        let result = crate::ai::transport::provider::decode(br#"{"id":"partial-request","model":"fixture-model","choices":[{"finish_reason":"content_filter","message":{"content":null}}],"usage":{"prompt_tokens":21,"completion_tokens":3}}"#).unwrap_err();
        assert!(result.message.contains("choices[0].message.content"));
        let details = result.diagnostics.unwrap();
        assert_eq!(details["response"]["id"], "partial-request");
        assert_eq!(details["response"]["usage"]["completion_tokens"], 3);
    }
}
