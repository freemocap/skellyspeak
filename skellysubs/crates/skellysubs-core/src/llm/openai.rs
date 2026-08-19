//! OpenAI-compatible HTTP client (blocking reqwest).
//!
//! One client covers OpenAI, OpenRouter, LM Studio, and Ollama's OpenAI-compatible
//! endpoint. base_url should be the API root, e.g.:
//!   - OpenAI:     https://api.openai.com/v1
//!   - OpenRouter: https://openrouter.ai/api/v1
//!   - Ollama:     http://localhost:11434/v1
//!   - LM Studio:  http://localhost:1234/v1

use std::time::Duration;

use reqwest::blocking::Client;
use schemars::JsonSchema;
use serde::de::DeserializeOwned;

use super::{
    json_schema_format, AiClient, ChatCompletionRequest, ChatCompletionResponse, ChatMessage,
    LlmError,
};

pub struct OpenAiCompatibleClient {
    base_url: String,
    api_key: Option<String>,
    model: String,
    client: Client,
}

impl OpenAiCompatibleClient {
    pub fn new(
        base_url: impl Into<String>,
        model: impl Into<String>,
        api_key: Option<String>,
    ) -> Result<Self, LlmError> {
        let client = Client::builder()
            .timeout(Duration::from_secs(180))
            .build()
            .map_err(|e| LlmError::Http(e.to_string()))?;
        Ok(Self {
            base_url: base_url.into(),
            api_key,
            model: model.into(),
            client,
        })
    }

    fn endpoint(&self) -> String {
        let base = self.base_url.trim_end_matches('/');
        if base.ends_with("/chat/completions") {
            base.to_string()
        } else {
            format!("{base}/chat/completions")
        }
    }
}

impl AiClient for OpenAiCompatibleClient {
    fn complete_structured<T>(&self, system_prompt: &str, response_name: &str) -> Result<T, LlmError>
    where
        T: DeserializeOwned + JsonSchema,
    {
        let request = build_chat_request::<T>(&self.model, system_prompt, response_name);
        let mut builder = self.client.post(self.endpoint()).json(&request);
        if let Some(key) = &self.api_key {
            builder = builder.bearer_auth(key);
        }
        let response = builder.send().map_err(|e| LlmError::Http(e.to_string()))?;
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().unwrap_or_default();
            return Err(LlmError::Http(format!("{status}: {text}")));
        }
        let body: ChatCompletionResponse = response
            .json()
            .map_err(|e| LlmError::Http(e.to_string()))?;
        let content = body
            .choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .filter(|c| !c.trim().is_empty())
            .ok_or(LlmError::MissingContent)?;
        parse_content(&content)
    }
}

/// Build a chat-completions request with a JSON-schema response format.
pub fn build_chat_request<T: JsonSchema>(
    model: &str,
    system_prompt: &str,
    response_name: &str,
) -> ChatCompletionRequest {
    ChatCompletionRequest {
        model: model.to_string(),
        messages: vec![ChatMessage {
            role: "system".into(),
            content: system_prompt.to_string(),
        }],
        stream: false,
        response_format: Some(json_schema_format::<T>(response_name, false)),
        temperature: 0.0,
    }
}

/// Deserialize the assistant's JSON content string into T.
pub fn parse_content<T: DeserializeOwned>(content: &str) -> Result<T, LlmError> {
    serde_json::from_str(content).map_err(LlmError::Json)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{MatchedTranslatedSegment, TranslatedText};

    #[test]
    fn build_chat_request_has_schema() {
        let req = build_chat_request::<MatchedTranslatedSegment>(
            "gpt-4o",
            "prompt",
            "MatchedTranslatedSegment",
        );
        assert_eq!(req.model, "gpt-4o");
        assert_eq!(req.messages.len(), 1);
        assert_eq!(req.messages[0].role, "system");
        assert_eq!(req.messages[0].content, "prompt");
        assert_eq!(req.temperature, 0.0);
        let rf = req.response_format.unwrap();
        assert_eq!(rf.format_type, "json_schema");
        assert_eq!(rf.json_schema.name, "MatchedTranslatedSegment");
        assert!(!rf.json_schema.strict);
        assert!(rf.json_schema.schema["properties"]["matched_translated_words"].is_object());
    }

    #[test]
    fn parse_content_round_trips() {
        let t: TranslatedText = parse_content(
            "{\"translated_text\":\"hola\",\"translated_language_name\":\"Spanish\"}",
        )
        .unwrap();
        assert_eq!(t.translated_text, "hola");
    }

    #[test]
    fn parse_content_rejects_invalid_json() {
        let e = parse_content::<TranslatedText>("not json").unwrap_err();
        assert!(matches!(e, LlmError::Json(_)));
    }
}
