//! OpenAI-compatible HTTP client (blocking reqwest).
//!
//! One client covers OpenAI, OpenRouter, LM Studio, and Ollama's OpenAI-compatible
//! endpoint. base_url should be the API root, e.g.:
//!   - OpenAI:     https://api.openai.com/v1
//!   - OpenRouter: https://openrouter.ai/api/v1
//!   - Ollama:     http://localhost:11434/v1
//!   - LM Studio:  http://localhost:1234/v1

use std::io::BufRead;
use std::time::Duration;

use reqwest::blocking::Client;
use schemars::JsonSchema;
use serde::de::DeserializeOwned;

use super::{
    json_object_format, AiClient, ChatCompletionRequest, ChatMessage, LlmError,
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

    /// Stream a plain-text completion (SSE), invoking `on_delta` per token.
    pub fn stream_text<F: FnMut(&str)>(
        &self,
        system_prompt: &str,
        mut on_delta: F,
    ) -> Result<String, LlmError> {
        let request = serde_json::json!({
            "model": self.model,
            "messages": [{ "role": "system", "content": system_prompt }],
            "stream": true,
            "temperature": 0.0,
        });
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

        let mut full = String::new();
        let mut reader = std::io::BufReader::new(response);
        let mut line = String::new();
        loop {
            line.clear();
            let n = reader.read_line(&mut line).map_err(|e| LlmError::Http(e.to_string()))?;
            if n == 0 {
                break;
            }
            let trimmed = line.trim();
            if let Some(data) = trimmed.strip_prefix("data:") {
                let data = data.trim();
                if data == "[DONE]" {
                    break;
                }
                if let Some(delta) = parse_sse_delta(data) {
                    full.push_str(&delta);
                    on_delta(&delta);
                }
            }
        }
        Ok(full)
    }
}

impl AiClient for OpenAiCompatibleClient {
    fn complete_structured<T>(&self, system_prompt: &str, response_name: &str) -> Result<T, LlmError>
    where
        T: DeserializeOwned + JsonSchema,
    {
        // Enforced structured output via forced function calling: the model must
        // return a tool call whose arguments match our (sanitized) JSON schema.
        let request = serde_json::json!({
            "model": self.model,
            "messages": [{ "role": "system", "content": system_prompt }],
            "tools": [{
                "type": "function",
                "function": {
                    "name": response_name,
                    "parameters": super::tool_schema::<T>(response_name)
                }
            }],
            "tool_choice": { "type": "function", "function": { "name": response_name } },
            "temperature": 0.0,
        });
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
        let body: serde_json::Value = response.json().map_err(|e| LlmError::Http(e.to_string()))?;
        let args = parse_tool_call_arguments(&body).ok_or(LlmError::MissingContent)?;
        parse_content(args)
    }
}

/// Build a chat-completions request that asks for a JSON object, injecting the
/// JSON Schema into the prompt. OpenAI rejects schemars' `format`/`minimum`/
/// tuple keywords in `response_format`, so we use `json_object` mode instead.
pub fn build_chat_request<T: JsonSchema>(
    model: &str,
    system_prompt: &str,
    response_name: &str,
) -> ChatCompletionRequest {
    let schema =
        serde_json::to_string_pretty(&schemars::schema_for!(T)).unwrap_or_else(|_| "{}".into());
    let content = format!(
        "{system_prompt}\n\nRespond with ONLY a single JSON object (no markdown fences, no commentary) matching this JSON Schema (name: {response_name}):\n{schema}"
    );
    ChatCompletionRequest {
        model: model.to_string(),
        messages: vec![ChatMessage {
            role: "system".into(),
            content,
        }],
        stream: false,
        response_format: Some(json_object_format()),
        temperature: 0.0,
    }
}

/// Deserialize the assistant's JSON content string into T (strips markdown
/// fences and surrounding prose first).
pub fn parse_content<T: DeserializeOwned>(content: &str) -> Result<T, LlmError> {
    serde_json::from_str(&super::extract_json(content)).map_err(LlmError::Json)
}

/// Extract the first tool call's JSON arguments string from a chat response.
pub fn parse_tool_call_arguments(body: &serde_json::Value) -> Option<&str> {
    body["choices"][0]["message"]["tool_calls"][0]["function"]["arguments"].as_str()
}

/// Extract the assistant text delta from one streaming `data:` payload.
pub fn parse_sse_delta(data: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(data).ok()?;
    let content = v["choices"][0]["delta"]["content"].as_str()?;
    if content.is_empty() {
        None
    } else {
        Some(content.to_string())
    }
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
        assert!(req.messages[0].content.contains("prompt"));
        assert!(req.messages[0].content.contains("matched_translated_words"));
        assert_eq!(req.temperature, 0.0);
        let rf = req.response_format.unwrap();
        assert_eq!(rf.format_type, "json_object");
        assert!(rf.json_schema.is_none());
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

    #[test]
    fn parse_sse_delta_extracts_content() {
        let delta = parse_sse_delta(r#"{"choices":[{"delta":{"content":"Hola"}}]}"#).unwrap();
        assert_eq!(delta, "Hola");
        assert!(parse_sse_delta(r#"{"choices":[{"delta":{}}]}"#).is_none());
        assert!(parse_sse_delta("not json").is_none());
    }

    #[test]
    fn parse_tool_call_arguments_extracts_json_string() {
        let body = serde_json::json!({
            "choices": [{ "message": { "tool_calls": [
                { "function": { "name": "Analysis", "arguments": "{\"tokens\":[]}" } }
            ] } }]
        });
        assert_eq!(parse_tool_call_arguments(&body), Some("{\"tokens\":[]}"));
        assert!(parse_tool_call_arguments(&serde_json::json!({})).is_none());
    }
}
