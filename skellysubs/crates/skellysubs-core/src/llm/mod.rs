//! Minimal structured-output LLM client interface (OpenAI-compatible).
//!
//! This module defines the types + trait only. The real HTTP client (reqwest)
//! lands in a later slice; the orchestrator is tested against an in-memory fake.

pub mod openai;

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
    pub json_schema: JsonSchemaDef,
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
        json_schema: JsonSchemaDef {
            name: name.into(),
            strict,
            schema,
        },
    }
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
}
