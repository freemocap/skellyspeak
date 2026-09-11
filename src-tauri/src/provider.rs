use crate::model::{AppError, ConnectionRoute, ErrorCode, Result};
use serde::{Deserialize, Serialize};
use std::{sync::OnceLock, time::Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptMessage {
    pub role: String,
    pub content: String,
}
#[derive(Debug)]
pub struct Completion {
    pub text: String,
    pub finish_reason: String,
    pub actual_model: String,
    pub provider_id: String,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
}
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
pub fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(90))
        .connect_timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| {
            AppError::new(
                ErrorCode::Provider,
                "Could not initialize the secure HTTP client.",
            )
        })
}
pub fn validate_key_format(key: &str) -> Result<()> {
    if key.chars().any(char::is_whitespace) {
        return Err(AppError::new(
            ErrorCode::Validation,
            "API keys cannot contain spaces or line breaks.",
        ));
    }
    if key.len() < 10 || key.len() > 4096 || !key.bytes().all(|b| b.is_ascii_graphic()) {
        return Err(AppError::new(ErrorCode::Validation, "Invalid API key."));
    }
    Ok(())
}

pub async fn verify_key(client: &reqwest::Client, key: &str) -> Result<()> {
    verify_key_at(client, key, "https://openrouter.ai/api/v1/key").await
}

async fn verify_key_at(client: &reqwest::Client, key: &str, url: &str) -> Result<()> {
    validate_key_format(key)?;
    let mut response = client.get(url).bearer_auth(key)
        .timeout(Duration::from_secs(15)).send().await.map_err(|_| AppError::new(
            ErrorCode::Provider, "Could not reach OpenRouter to verify the key. Check your connection and try again.",
        ))?;
    if response.status().as_u16() != 200 {
        let detail = match response.status().as_u16() {
            401 | 403 => "OpenRouter rejected this API key.".to_string(),
            429 => {
                "OpenRouter rate-limited key verification. Wait before trying again.".to_string()
            }
            status => {
                format!("OpenRouter key verification failed (HTTP {status}). Try again later.")
            }
        };
        return Err(AppError::new(ErrorCode::Provider, detail));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| key_response_error())? {
        if bytes.len() + chunk.len() > 65536 {
            return Err(key_response_error());
        }
        bytes.extend_from_slice(&chunk);
    }
    let value: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| key_response_error())?;
    if !value.get("data").is_some_and(|data| data.is_object()) {
        return Err(key_response_error());
    }
    Ok(())
}
fn key_response_error() -> AppError {
    AppError::new(
        ErrorCode::Provider,
        "OpenRouter returned an unreadable key verification response. The key has not been verified.",
    )
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
fn malformed() -> AppError {
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
pub async fn complete(
    client: &reqwest::Client,
    key: &str,
    dispatch: &crate::execution::Dispatch,
) -> Result<Completion> {
    if dispatch.route != ConnectionRoute::Openrouter {
        return crate::grouped::complete(client, key, dispatch).await;
    }
    let url = &dispatch.target.url;
    request(
        client,
        url,
        key,
        &dispatch.model,
        &dispatch.messages,
        dispatch.route,
        &dispatch.install_id,
    )
    .await
}
pub fn payload(
    model: &str,
    messages: &[PromptMessage],
    route: ConnectionRoute,
) -> Result<serde_json::Value> {
    if route == ConnectionRoute::Hosted && model != "google/gemini-2.5-flash" {
        return Err(AppError::new(
            ErrorCode::Validation,
            "The hosted route only supports the approved Standard model.",
        ));
    }
    let mut payload = serde_json::json!({"model":model,"messages":messages,"stream":false,"max_tokens":2048,"temperature":0.7,"reasoning":{"enabled":false}});
    if route == ConnectionRoute::Openrouter {
        payload["provider"] = serde_json::json!({"allow_fallbacks":false});
    }
    Ok(payload)
}
/// Transport-local request contract; never inferred from prompt text or serialized over IPC.
#[derive(Clone, Copy, Debug)]
pub enum RequestOutput<'a> {
    Prose,
    JsonSchema {
        name: &'a str,
        schema: &'a serde_json::Value,
    },
}

const STRUCTURED_INPUT_LIMIT: usize = 100_000;
const SERVER_INPUT_OVERHEAD: usize = 1024;

fn structured_error(message: &str) -> AppError {
    AppError::new(ErrorCode::Validation, message)
}

/// Bound Python json.dumps(ensure_ascii=False) size, including its default spaces.
/// Float spellings can differ between runtimes; reserve 16 extra bytes per float.
/// This is deliberately a conservative byte bound, not a token count.
fn structured_input_bound(value: &serde_json::Value) -> Result<usize> {
    use serde_json::Value;
    let mut pending = vec![(value, 0usize)];
    let mut bytes = SERVER_INPUT_OVERHEAD;
    while let Some((value, depth)) = pending.pop() {
        if depth > 64 {
            return Err(structured_error(
                "Structured request exceeds the nesting limit.",
            ));
        }
        let size = match value {
            Value::Array(items) => {
                pending.extend(items.iter().map(|item| (item, depth + 1)));
                2 + items.len().saturating_sub(1) * 2
            }
            Value::Object(fields) => {
                let mut size = 2 + fields.len().saturating_sub(1) * 2;
                for (key, value) in fields {
                    if key.len() > STRUCTURED_INPUT_LIMIT {
                        return Err(structured_error(
                            "Structured request exceeds its input limit.",
                        ));
                    }
                    size += serde_json::to_vec(key)?.len() + 2;
                    pending.push((value, depth + 1));
                }
                size
            }
            Value::String(text) => {
                if text.len() > STRUCTURED_INPUT_LIMIT {
                    return Err(structured_error(
                        "Structured request exceeds its input limit.",
                    ));
                }
                serde_json::to_vec(text)?.len()
            }
            Value::Number(number) => {
                number.to_string().len() + if number.is_f64() { 16 } else { 0 }
            }
            Value::Bool(true) => 4,
            Value::Bool(false) => 5,
            Value::Null => 4,
        };
        bytes = bytes
            .checked_add(size)
            .ok_or_else(|| structured_error("Structured request exceeds its input limit."))?;
        if bytes > STRUCTURED_INPUT_LIMIT {
            return Err(structured_error(
                "Structured request exceeds its input limit.",
            ));
        }
    }
    Ok(bytes)
}

pub fn payload_with_output(
    model: &str,
    messages: &[PromptMessage],
    route: ConnectionRoute,
    output: RequestOutput<'_>,
) -> Result<serde_json::Value> {
    let RequestOutput::JsonSchema { name, schema } = output else {
        return payload(model, messages, route);
    };
    // The server accepts a strict named schema object. Restrict names to portable
    // identifiers locally; nested schema keyword support remains provider-owned.
    if name.is_empty()
        || name.len() > 64
        || !name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"_-".contains(&b))
        || !schema.is_object()
    {
        return Err(structured_error(
            "Structured output requires a valid schema name and schema object.",
        ));
    }
    if messages.is_empty()
        || messages.len() > 64
        || messages
            .iter()
            .any(|m| !matches!(m.role.as_str(), "system" | "user" | "assistant"))
    {
        return Err(structured_error(
            "Structured requests require 1–64 text messages with supported roles.",
        ));
    }
    if route != ConnectionRoute::Openrouter && model != "google/gemini-2.5-flash" {
        return Err(structured_error(
            "The grouped route only supports the approved Standard model.",
        ));
    }
    // Reject already-oversized raw inputs before the payload builder clones them.
    let raw_bytes = messages.iter().try_fold(model.len(), |total, message| {
        total.checked_add(message.content.len())
    });
    if raw_bytes.is_none_or(|bytes| bytes > STRUCTURED_INPUT_LIMIT) {
        return Err(structured_error(
            "Structured request exceeds its input limit.",
        ));
    }
    // Check depth/size before cloning or serializing a caller-supplied schema.
    structured_input_bound(schema)?;
    let mut request = payload(model, messages, route)?;
    request["response_format"] = serde_json::json!({"type":"json_schema","json_schema":{"name":name,"strict":true,"schema":schema}});
    if route == ConnectionRoute::Openrouter {
        request["provider"] =
            serde_json::json!({"allow_fallbacks":false,"require_parameters":true});
    }
    structured_input_bound(&request)?;
    Ok(request)
}

/// Explicit structured transport entry point. Existing callers remain prose-only.
pub async fn complete_with_output(
    client: &reqwest::Client,
    key: &str,
    dispatch: &crate::execution::Dispatch,
    output: RequestOutput<'_>,
) -> Result<Completion> {
    if matches!(output, RequestOutput::Prose) {
        return complete(client, key, dispatch).await;
    }
    if dispatch.route != ConnectionRoute::Openrouter {
        return crate::grouped::complete_with_output(client, key, dispatch, output).await;
    }
    let body = payload_with_output(&dispatch.model, &dispatch.messages, dispatch.route, output)?;
    request_payload(
        client,
        &dispatch.target.url,
        key,
        dispatch.route,
        &dispatch.install_id,
        body,
    )
    .await
}

async fn request(
    client: &reqwest::Client,
    url: &str,
    key: &str,
    model: &str,
    messages: &[PromptMessage],
    route: ConnectionRoute,
    install: &str,
) -> Result<Completion> {
    request_payload(
        client,
        url,
        key,
        route,
        install,
        payload(model, messages, route)?,
    )
    .await
}

async fn request_payload(
    client: &reqwest::Client,
    url: &str,
    key: &str,
    route: ConnectionRoute,
    install: &str,
    payload: serde_json::Value,
) -> Result<Completion> {
    let request = client.post(url).json(&payload);
    let request = if key.is_empty() {
        request
    } else {
        request.bearer_auth(key)
    };
    let request = if route == ConnectionRoute::Hosted {
        crate::hosted::identity(request, install)
    } else {
        request
    };
    let mut response=request.send().await.map_err(|_|AppError::new(ErrorCode::UnknownOutcome,"Provider outcome unknown: connection interrupted or timed out. A charge may have occurred. No automatic retry was made."))?;
    if !response.status().is_success() && route == ConnectionRoute::Hosted {
        return match crate::hosted::body(response).await {
            Err(error) => Err(error),
            Ok(_) => Err(malformed()),
        };
    }
    if !response.status().is_success() {
        let error = AppError::new(
            ErrorCode::Provider,
            format!(
                "{} HTTP {}. Check sign-in, allowance and model access in Settings. No automatic retry was made.",
                route.label(),
                response.status().as_u16()
            ),
        );
        return Err(if response.status().as_u16() == 429 {
            error.with_refusal(crate::refusal::from_response(&response))
        } else {
            error
        });
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| malformed())? {
        if bytes.len() + chunk.len() > 262144 {
            return Err(malformed());
        }
        bytes.extend_from_slice(&chunk);
    }
    decode(&bytes)
}

#[cfg(test)]
mod tests {
    #[test]
    fn structured_payload_preserves_prose_and_routes_strict_schema() {
        let schema = serde_json::json!({"type":"object","additionalProperties":false,"properties":{"spans":{"type":"array"}},"required":["spans"]});
        let messages = vec![PromptMessage {
            role: "user".into(),
            content: "Sí 你好".into(),
        }];
        for route in [
            ConnectionRoute::Openrouter,
            ConnectionRoute::Hosted,
            ConnectionRoute::Custom,
        ] {
            let prose = payload("google/gemini-2.5-flash", &messages, route).unwrap();
            assert_eq!(
                prose,
                payload_with_output(
                    "google/gemini-2.5-flash",
                    &messages,
                    route,
                    RequestOutput::Prose
                )
                .unwrap()
            );
            assert!(prose.get("response_format").is_none());
            let structured = payload_with_output(
                "google/gemini-2.5-flash",
                &messages,
                route,
                RequestOutput::JsonSchema {
                    name: "word_gloss_v1",
                    schema: &schema,
                },
            )
            .unwrap();
            assert_eq!(
                structured["response_format"],
                serde_json::json!({"type":"json_schema","json_schema":{"name":"word_gloss_v1","strict":true,"schema":schema}})
            );
            assert_eq!(structured["messages"], prose["messages"]);
            assert_eq!(structured["max_tokens"], 2048);
            assert_eq!(structured["temperature"], 0.7);
            assert_eq!(
                structured["reasoning"],
                serde_json::json!({"enabled":false})
            );
            if route == ConnectionRoute::Openrouter {
                assert_eq!(
                    structured["provider"],
                    serde_json::json!({"allow_fallbacks":false,"require_parameters":true})
                );
                assert_eq!(
                    prose["provider"],
                    serde_json::json!({"allow_fallbacks":false})
                );
            } else {
                assert!(structured.get("provider").is_none());
            }
        }
    }

    #[test]
    fn structured_bounds_include_schema_python_spaces_escaping_and_float_headroom() {
        let sample = serde_json::json!({"é":["a\n", true, 1, null]});
        let python = "{\"é\": [\"a\\n\", true, 1, null]}";
        assert_eq!(
            structured_input_bound(&sample).unwrap(),
            python.len() + SERVER_INPUT_OVERHEAD
        );
        for (number, python) in [
            (1e-7, "1e-07"),
            (1e20, "1e+20"),
            (1e100, "1e+100"),
            (-0.0, "-0.0"),
        ] {
            assert!(
                structured_input_bound(&serde_json::json!(number)).unwrap()
                    >= python.len() + SERVER_INPUT_OVERHEAD
            );
        }
        let schema = serde_json::json!({"description":"schema content", "type":"object"});
        for route in [
            ConnectionRoute::Hosted,
            ConnectionRoute::Custom,
            ConnectionRoute::Openrouter,
        ] {
            let mut messages = vec![PromptMessage {
                role: "user".into(),
                content: String::new(),
            }];
            let output = RequestOutput::JsonSchema {
                name: "bounded",
                schema: &schema,
            };
            let base =
                payload_with_output("google/gemini-2.5-flash", &messages, route, output).unwrap();
            let room = STRUCTURED_INPUT_LIMIT - structured_input_bound(&base).unwrap();
            messages[0].content = "x".repeat(room);
            assert!(
                payload_with_output("google/gemini-2.5-flash", &messages, route, output).is_ok()
            );
            messages[0].content.push('x');
            assert_eq!(
                payload_with_output("google/gemini-2.5-flash", &messages, route, output)
                    .unwrap_err()
                    .code,
                ErrorCode::Validation
            );
            messages[0].content = "\n".repeat(room / 2 + 1);
            assert!(
                payload_with_output("google/gemini-2.5-flash", &messages, route, output).is_err()
            );
        }
        let huge_schema = serde_json::json!({"description":"s".repeat(100_000)});
        assert!(
            payload_with_output(
                "google/gemini-2.5-flash",
                &[PromptMessage {
                    role: "user".into(),
                    content: "small".into()
                }],
                ConnectionRoute::Hosted,
                RequestOutput::JsonSchema {
                    name: "schema",
                    schema: &huge_schema
                }
            )
            .is_err()
        );
    }

    #[test]
    fn structured_invalid_contracts_fail_with_content_free_errors() {
        let schema = serde_json::json!({});
        let messages = vec![PromptMessage {
            role: "user".into(),
            content: "private fixture".into(),
        }];
        for name in ["", "private schema name!", &"n".repeat(65)] {
            let error = payload_with_output(
                "google/gemini-2.5-flash",
                &messages,
                ConnectionRoute::Hosted,
                RequestOutput::JsonSchema {
                    name,
                    schema: &schema,
                },
            )
            .unwrap_err();
            assert_eq!(error.code, ErrorCode::Validation);
            assert!(!error.message.contains("private"));
        }
        for schema in [
            serde_json::json!(true),
            serde_json::json!([]),
            serde_json::Value::Null,
        ] {
            assert!(
                payload_with_output(
                    "chosen/model",
                    &messages,
                    ConnectionRoute::Openrouter,
                    RequestOutput::JsonSchema {
                        name: "schema",
                        schema: &schema
                    }
                )
                .is_err()
            );
        }
        let output = RequestOutput::JsonSchema {
            name: "schema",
            schema: &schema,
        };
        assert!(
            payload_with_output("chosen/model", &messages, ConnectionRoute::Custom, output)
                .is_err()
        );
        assert!(
            payload_with_output("chosen/model", &[], ConnectionRoute::Openrouter, output).is_err()
        );
        let unsupported = [PromptMessage {
            role: "tool".into(),
            content: "private fixture".into(),
        }];
        assert!(
            payload_with_output(
                "chosen/model",
                &unsupported,
                ConnectionRoute::Openrouter,
                output
            )
            .is_err()
        );
        let mut nested = serde_json::json!({});
        for _ in 0..70 {
            nested = serde_json::json!({"items":nested});
        }
        assert!(
            payload_with_output(
                "chosen/model",
                &messages,
                ConnectionRoute::Openrouter,
                RequestOutput::JsonSchema {
                    name: "schema",
                    schema: &nested
                }
            )
            .is_err()
        );
    }
    #[test]
    fn validate_key_messages_distinguish_whitespace() {
        assert_eq!(
            super::validate_key_format("bad").unwrap_err().message,
            "Invalid API key."
        );
        assert_eq!(
            super::validate_key_format("key with spaces")
                .unwrap_err()
                .message,
            "API keys cannot contain spaces or line breaks."
        );
        assert!(super::validate_key_format("test-credential").is_ok());
    }

    use super::*;
    #[test]
    fn hosted_payload_obeys_service_routing_and_model_contract() {
        let hosted = payload("google/gemini-2.5-flash", &[], ConnectionRoute::Hosted).unwrap();
        assert!(hosted.get("provider").is_none());
        assert_eq!(hosted["max_tokens"], 2048);
        assert_eq!(hosted["stream"], false);
        assert!(payload("google/gemini-2.5-flash-lite", &[], ConnectionRoute::Hosted).is_err());
        let direct = payload("chosen/model", &[], ConnectionRoute::Openrouter).unwrap();
        assert_eq!(direct["provider"]["allow_fallbacks"], false);
    }
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
}

#[cfg(test)]
mod transport_tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    fn server(
        status: &str,
        body: &str,
        extra: &str,
    ) -> (String, std::thread::JoinHandle<serde_json::Value>) {
        server_auth(status, body, extra, true)
    }
    fn server_auth(
        status: &str,
        body: &str,
        extra: &str,
        auth: bool,
    ) -> (String, std::thread::JoinHandle<serde_json::Value>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}/chat/completions", listener.local_addr().unwrap());
        let response = format!(
            "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n{extra}\r\n{body}",
            body.len()
        );
        let worker = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut received = Vec::new();
            let mut buffer = [0u8; 4096];
            let end = loop {
                let count = stream.read(&mut buffer).unwrap();
                assert!(count > 0);
                received.extend_from_slice(&buffer[..count]);
                if let Some(end) = received.windows(4).position(|s| s == b"\r\n\r\n") {
                    break end + 4;
                }
            };
            let headers = String::from_utf8(received[..end].to_vec()).unwrap();
            assert_eq!(
                headers
                    .to_lowercase()
                    .contains("authorization: bearer test-credential"),
                auth
            );
            if !auth {
                assert!(!headers.to_lowercase().contains("authorization:"));
            }

            let length: usize = headers
                .lines()
                .find_map(|line| {
                    line.to_lowercase()
                        .strip_prefix("content-length:")
                        .map(|n| n.trim().parse().unwrap())
                })
                .unwrap_or(0);
            while received.len() < end + length {
                let count = stream.read(&mut buffer).unwrap();
                assert!(count > 0);
                received.extend_from_slice(&buffer[..count]);
            }
            let payload = if length == 0 {
                assert!(headers.starts_with("GET "));
                serde_json::Value::Null
            } else {
                serde_json::from_slice(&received[end..end + length]).unwrap()
            };
            stream.write_all(response.as_bytes()).unwrap();
            payload
        });
        (url, worker)
    }
    fn structured_dispatch(url: String, route: ConnectionRoute) -> crate::execution::Dispatch {
        crate::execution::Dispatch {
            target: crate::access::ResolvedTarget {
                route,
                revision: 1,
                url,
                model: "google/gemini-2.5-flash".into(),
                credential: Some("test-credential".into()),
            },
            attempt: "2000000000-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa".into(),
            operation: "11111111-1111-1111-1111-111111111111".into(),
            credential: "test-credential".into(),
            model: "google/gemini-2.5-flash".into(),
            messages: vec![PromptMessage {
                role: "user".into(),
                content: "fixture".into(),
            }],
            route,
            install_id: "test".into(),
        }
    }
    #[tokio::test]
    async fn structured_direct_preserves_raw_candidate_finish_usage_and_redaction() {
        let schema = serde_json::json!({"type":"object"});
        let contract = RequestOutput::JsonSchema {
            name: "fixture",
            schema: &schema,
        };
        for finish in ["stop", "length"] {
            let raw = serde_json::json!({"id":"request", "model":"actual", "choices":[{"finish_reason":finish,"message":{"content":"{\"same\":1,\"same\":2}"}}],"usage":{"prompt_tokens":12,"completion_tokens":3}}).to_string();
            let (url, worker) = server("200 OK", &raw, "");
            let result = complete_with_output(
                &client().unwrap(),
                "test-credential",
                &structured_dispatch(url, ConnectionRoute::Openrouter),
                contract,
            )
            .await
            .unwrap();
            assert_eq!(result.text, "{\"same\":1,\"same\":2}");
            assert_eq!(result.finish_reason, finish);
            assert_eq!(
                (result.input_tokens, result.output_tokens),
                (Some(12), Some(3))
            );
            let payload = worker.join().unwrap();
            assert_eq!(payload["response_format"]["json_schema"]["schema"], schema);
            assert_eq!(
                payload["provider"],
                serde_json::json!({"allow_fallbacks":false,"require_parameters":true})
            );
        }
        let destination = TcpListener::bind("127.0.0.1:0").unwrap();
        destination.set_nonblocking(true).unwrap();
        let (url, worker) = server(
            "302 Found",
            "private-schema test-credential",
            &format!(
                "Location: http://{}/leak\r\n",
                destination.local_addr().unwrap()
            ),
        );
        let error = complete_with_output(
            &client().unwrap(),
            "test-credential",
            &structured_dispatch(url, ConnectionRoute::Openrouter),
            contract,
        )
        .await
        .unwrap_err();
        worker.join().unwrap();
        assert!(!error.message.contains("private-schema"));
        assert!(!error.message.contains("test-credential"));
        assert_eq!(
            destination.accept().unwrap_err().kind(),
            std::io::ErrorKind::WouldBlock
        );
    }
    #[tokio::test]
    async fn structured_invalid_preflight_submits_no_http_for_any_route_or_group() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let url = format!("http://{}/v1/operations", listener.local_addr().unwrap());
        let schema = serde_json::json!({"description":"private-schema".repeat(10000)});
        let contract = RequestOutput::JsonSchema {
            name: "fixture",
            schema: &schema,
        };
        let client = client().unwrap();
        for route in [
            ConnectionRoute::Hosted,
            ConnectionRoute::Custom,
            ConnectionRoute::Openrouter,
        ] {
            let error = complete_with_output(
                &client,
                "test-credential",
                &structured_dispatch(url.clone(), route),
                contract,
            )
            .await
            .unwrap_err();
            assert_eq!(error.code, ErrorCode::Validation);
            assert!(!error.message.contains("private-schema"));
        }
        let dispatches = [
            structured_dispatch(url.clone(), ConnectionRoute::Hosted),
            structured_dispatch(url, ConnectionRoute::Hosted),
        ];
        for outputs in [
            vec![RequestOutput::Prose],
            vec![RequestOutput::Prose, contract],
        ] {
            let error = crate::grouped::request_with_outputs(
                &client,
                "test-credential",
                &dispatches,
                &outputs,
                |_, _| panic!("preflight must not publish"),
            )
            .await
            .unwrap_err();
            assert_eq!(error.code, ErrorCode::Validation);
        }
        assert_eq!(
            listener.accept().unwrap_err().kind(),
            std::io::ErrorKind::WouldBlock
        );
    }
    #[tokio::test]
    async fn key_verification_checks_authentication_without_a_completion() {
        let (url, worker) = server("200 OK", r#"{"data":{"label":"test"}}"#, "");
        verify_key_at(&client().unwrap(), "test-credential", &url)
            .await
            .unwrap();
        assert_eq!(worker.join().unwrap(), serde_json::Value::Null);
    }
    #[tokio::test]
    async fn key_verification_reports_rejection_without_echoing_response() {
        for (status, body) in [
            ("401 Unauthorized", "private response"),
            ("200 OK", "not JSON"),
        ] {
            let (url, worker) = server(status, body, "");
            let error = verify_key_at(&client().unwrap(), "test-credential", &url)
                .await
                .unwrap_err();
            assert!(!error.message.contains(body));
            assert!(!error.message.contains("test-credential"));
            worker.join().unwrap();
        }
    }
    #[tokio::test]
    async fn adapter_sends_explicit_target_and_normalizes_usage() {
        let (url, worker) = server(
            "200 OK",
            r#"{"id":"request-id","model":"actual-model","choices":[{"finish_reason":"stop","message":{"content":"Hola"}}],"usage":{"prompt_tokens":12,"completion_tokens":3}}"#,
            "",
        );
        let output = request(
            &client().unwrap(),
            &url,
            "test-credential",
            "selected-model",
            &[PromptMessage {
                role: "user".into(),
                content: "Hi".into(),
            }],
            ConnectionRoute::Openrouter,
            "test-install",
        )
        .await
        .unwrap();
        assert_eq!(output.text, "Hola");
        assert_eq!(output.output_tokens, Some(3));
        let payload = worker.join().unwrap();
        assert_eq!(payload["model"], "selected-model");
        assert_eq!(payload["provider"]["allow_fallbacks"], false);
        assert_eq!(payload["stream"], false);
    }
    #[tokio::test]
    async fn hosted_admission_error_preserves_reason_and_retry_after() {
        let (url, worker) = server(
            "429 Too Many Requests",
            r#"{"detail":"Daily request limit reached. Resets at 00:00 UTC."}"#,
            "Retry-After: 60\r\n",
        );
        let error = request(
            &client().unwrap(),
            &url,
            "test-credential",
            "google/gemini-2.5-flash",
            &[],
            ConnectionRoute::Hosted,
            "test-install",
        )
        .await
        .unwrap_err();
        worker.join().unwrap();
        assert!(error.message.contains("Daily request limit reached"));
        assert!(error.message.contains("Retry-After: 60 seconds"));
        let refusal = error.refusal.unwrap();
        assert!(refusal.retry_at.unwrap() > crate::refusal::now());
        assert!(!refusal.service_wide); // Text alone cannot widen the scope.
        assert!(!error.message.contains("test-credential"));
    }
    #[tokio::test]
    async fn redirects_are_not_followed_and_provider_errors_are_redacted() {
        let destination = TcpListener::bind("127.0.0.1:0").unwrap();
        destination.set_nonblocking(true).unwrap();
        let (url, worker) = server(
            "302 Found",
            "test-credential must not be returned",
            &format!(
                "Location: http://{}/leak\r\n",
                destination.local_addr().unwrap()
            ),
        );
        let error = request(
            &client().unwrap(),
            &url,
            "test-credential",
            "selected-model",
            &[],
            ConnectionRoute::Openrouter,
            "test-install",
        )
        .await
        .unwrap_err();
        worker.join().unwrap();
        assert!(error.message.contains("302"));
        assert!(!error.message.contains("test-credential"));
        assert_eq!(
            destination.accept().unwrap_err().kind(),
            std::io::ErrorKind::WouldBlock
        );
    }
}
