//! Minimal structured-output LLM client interface (OpenAI-compatible).
//!
//! This module defines the types + trait only. The real HTTP client (reqwest)
//! lands in a later slice; the orchestrator is tested against an in-memory fake.

pub mod anthropic;
pub mod openai;

pub use anthropic::{extract_json, AnthropicCompatibleClient};
pub use openai::{build_chat_request, parse_content, OpenAiCompatibleClient};

use std::fmt;

use schemars::JsonSchema;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JsonSchemaDef {
    pub name: String,
    pub strict: bool,
    pub schema: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResponseFormat {
    #[serde(rename = "type")]
    pub format_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub json_schema: Option<JsonSchemaDef>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_format: Option<ResponseFormat>,
    pub temperature: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub choices: Vec<Choice>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Choice {
    pub message: ChatMessage,
}

#[derive(Debug)]
pub enum LlmError {
    Http(String),
    Json(serde_json::Error),
    MissingContent,
}

impl fmt::Display for LlmError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LlmError::Http(m) => write!(f, "HTTP error: {m}"),
            LlmError::Json(e) => write!(f, "JSON error: {e}"),
            LlmError::MissingContent => write!(f, "missing content in LLM response"),
        }
    }
}

impl std::error::Error for LlmError {}

/// A structured-output LLM client. Sync for now; the async HTTP impl wraps this
/// (or we refactor to async when reqwest lands).
pub trait AiClient {
    fn complete_structured<T>(&self, system_prompt: &str, response_name: &str) -> Result<T, LlmError>
    where
        T: DeserializeOwned + JsonSchema;
}

/// Build an OpenAI-compatible response_format value from a schemars type.
pub fn json_schema_format<T: JsonSchema>(name: &str, strict: bool) -> ResponseFormat {
    let schema = serde_json::to_value(schemars::schema_for!(T)).unwrap_or(serde_json::Value::Null);
    ResponseFormat {
        format_type: "json_schema".into(),
        json_schema: Some(JsonSchemaDef {
            name: name.into(),
            strict,
            schema,
        }),
    }
}

/// `json_object` mode — the broadest OpenAI-compatible structured output. The
/// server only requires *some* JSON (no schema validation), so we inject the
/// schema into the prompt instead. Avoids OpenAI rejecting schemars' `format`/
/// `minimum`/tuple keywords.
pub fn json_object_format() -> ResponseFormat {
    ResponseFormat {
        format_type: "json_object".into(),
        json_schema: None,
    }
}

/// Recursively strip JSON-Schema keywords that OpenAI/Anthropic tool schemas
/// reject (or that cross-provider routers choke on) and normalize tuple arrays
/// (items: [..] / prefixItems) into a plain items schema.
pub fn sanitize_schema(v: &mut serde_json::Value) {
    match v {
        serde_json::Value::Object(m) => {
            const DROP: [&str; 15] = [
                "format",
                "minimum",
                "maximum",
                "exclusiveMinimum",
                "exclusiveMaximum",
                "multipleOf",
                "pattern",
                "minLength",
                "maxLength",
                "minItems",
                "maxItems",
                "uniqueItems",
                "minProperties",
                "maxProperties",
                "additionalProperties",
            ];
            for k in DROP {
                m.remove(k);
            }
            if let Some(serde_json::Value::Array(items)) = m.get("items").cloned() {
                let single = items
                    .into_iter()
                    .next()
                    .unwrap_or_else(|| serde_json::Value::Object(serde_json::Map::new()));
                m.insert("items".into(), single);
            }
            if m.remove("prefixItems").is_some() {
                m.entry("items")
                    .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));
            }
            for val in m.values_mut() {
                sanitize_schema(val);
            }
        }
        serde_json::Value::Array(arr) => {
            for val in arr.iter_mut() {
                sanitize_schema(val);
            }
        }
        _ => {}
    }
}

/// A provider-safe JSON Schema for a tool's parameters / input_schema, derived
/// from a schemars type and stripped of unsupported keywords.
pub fn tool_schema<T: JsonSchema>(name: &str) -> serde_json::Value {
    let root = serde_json::to_value(schemars::schema_for!(T)).unwrap_or(serde_json::Value::Null);
    let mut schema = root;
    if let Some(obj) = schema.as_object_mut() {
        obj.remove("$schema");
        obj.remove("$id");
        obj.insert("title".into(), serde_json::Value::String(name.to_string()));
    }
    sanitize_schema(&mut schema);
    schema
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::MatchedTranslatedSegment;

    #[test]
    fn request_serializes() {
        let req = ChatCompletionRequest {
            model: "gpt-4o".into(),
            messages: vec![ChatMessage {
                role: "system".into(),
                content: "hello".into(),
            }],
            stream: false,
            response_format: Some(json_schema_format::<MatchedTranslatedSegment>("MatchedTranslatedSegment", true)),
            temperature: 0.0,
        };
        let v = serde_json::to_value(&req).unwrap();
        assert_eq!(v["model"], "gpt-4o");
        assert_eq!(v["response_format"]["type"], "json_schema");
        assert!(v["response_format"]["json_schema"]["schema"]["properties"]["matched_translated_words"].is_object());
    }

    #[test]
    fn response_deserializes() {
        let v = serde_json::json!({
            "choices": [{ "message": { "role": "assistant", "content": "{\"translated_text\":\"hola\"}" } }]
        });
        let resp: ChatCompletionResponse = serde_json::from_value(v).unwrap();
        assert_eq!(resp.choices[0].message.content, "{\"translated_text\":\"hola\"}");
    }

    #[test]
    fn sanitize_schema_strips_unsupported_keywords_and_tuples() {
        let mut v = serde_json::json!({
            "type": "object",
            "properties": {
                "token_index": {"type": "integer", "format": "uint", "minimum": 0},
                "token_span": {"type": "array", "items": [{"type": "integer"}, {"type": "integer"}], "minItems": 2},
                "extra": {"type": "string", "pattern": "x", "additionalProperties": false}
            }
        });
        sanitize_schema(&mut v);
        let p = &v["properties"];
        assert!(p["token_index"].get("format").is_none());
        assert!(p["token_index"].get("minimum").is_none());
        assert!(p["token_span"]["items"].is_object());
        assert!(p["token_span"].get("minItems").is_none());
        assert!(p["extra"].get("pattern").is_none());
        assert!(p["extra"].get("additionalProperties").is_none());
    }
}
