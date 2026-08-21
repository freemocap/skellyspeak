//! Anthropic Messages API client (blocking reqwest).
//!
//! Anthropic has no JSON-schema response_format, so structured output is done
//! by injecting the JSON Schema into the system prompt and parsing the reply.

use std::time::Duration;

use reqwest::blocking::Client;
use schemars::JsonSchema;
use serde::de::DeserializeOwned;

use super::{AiClient, LlmError};

pub struct AnthropicCompatibleClient {
    base_url: String,
    api_key: String,
    model: String,
    client: Client,
}

impl AnthropicCompatibleClient {
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
            api_key: api_key.unwrap_or_default(),
            model: model.into(),
            client,
        })
    }

    fn endpoint(&self) -> String {
        let base = self.base_url.trim_end_matches('/');
        if base.ends_with("/messages") {
            base.to_string()
        } else {
            format!("{base}/messages")
        }
    }

    /// Non-streaming fallback for the Anthropic path: fetch the whole reply,
    /// then emit it once (so `LlmClient::stream_text` has a uniform shape).
    pub fn stream_text<F: FnMut(&str)>(
        &self,
        system_prompt: &str,
        mut on_delta: F,
    ) -> Result<String, LlmError> {
        let request = serde_json::json!({
            "model": self.model,
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [{ "role": "user", "content": "Reply now." }]
        });
        let response = self
            .client
            .post(self.endpoint())
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&request)
            .send()
            .map_err(|e| LlmError::Http(e.to_string()))?;
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().unwrap_or_default();
            return Err(LlmError::Http(format!("{status}: {text}")));
        }
        let body: AnthropicResponse = response.json().map_err(|e| LlmError::Http(e.to_string()))?;
        let text = body
            .content
            .into_iter()
            .find(|c| c.kind == "text")
            .map(|c| c.text)
            .unwrap_or_default();
        on_delta(&text);
        Ok(text)
    }
}

/// Build an Anthropic Messages request, folding the JSON Schema into the
/// system prompt so the model returns a parseable JSON object.
pub fn build_anthropic_request<T: JsonSchema>(
    model: &str,
    system_prompt: &str,
    response_name: &str,
) -> serde_json::Value {
    let schema =
        serde_json::to_string_pretty(&schemars::schema_for!(T)).unwrap_or_else(|_| "{}".into());
    let system = format!(
        "{system_prompt}\n\nRespond with ONLY a single JSON object (no markdown fences, no commentary) matching this JSON Schema (name: {response_name}):\n{schema}"
    );
    serde_json::json!({
        "model": model,
        "max_tokens": 1024,
        "system": system,
        "messages": [{ "role": "user", "content": "Now produce the JSON object." }]
    })
}

/// Pull a JSON object out of an assistant reply (strips markdown fences and
/// surrounding prose).
pub fn extract_json(text: &str) -> String {
    let mut t = text.trim().to_string();
    if let Some(rest) = t.strip_prefix("\u{0060}\u{0060}\u{0060}json") {
        t = rest.to_string();
    } else if let Some(rest) = t.strip_prefix("\u{0060}\u{0060}\u{0060}") {
        t = rest.to_string();
    }
    if t.ends_with("\u{0060}\u{0060}\u{0060}") {
        t.truncate(t.len() - 3);
    }
    let t = t.trim();
    if let (Some(s), Some(e)) = (t.find('{'), t.rfind('}')) {
        if s < e {
            return t[s..=e].to_string();
        }
    }
    t.to_string()
}

#[derive(serde::Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(serde::Deserialize)]
struct AnthropicContent {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    text: String,
    #[serde(default)]
    input: Option<serde_json::Value>,
}

impl AiClient for AnthropicCompatibleClient {
    fn complete_structured<T>(&self, system_prompt: &str, response_name: &str) -> Result<T, LlmError>
    where
        T: DeserializeOwned + JsonSchema,
    {
        // Enforced structured output via forced tool-use (Anthropic's native
        // guaranteed-schema mechanism): pin tool_choice to our tool and read the
        // JSON object out of the tool_use content block.
        let request = serde_json::json!({
            "model": self.model,
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [{ "role": "user", "content": "Now produce the requested data." }],
            "tools": [{ "name": response_name, "input_schema": super::tool_schema::<T>(response_name) }],
            "tool_choice": { "type": "tool", "name": response_name },
        });
        let response = self
            .client
            .post(self.endpoint())
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&request)
            .send()
            .map_err(|e| LlmError::Http(e.to_string()))?;
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().unwrap_or_default();
            return Err(LlmError::Http(format!("{status}: {text}")));
        }
        let body: AnthropicResponse = response.json().map_err(|e| LlmError::Http(e.to_string()))?;
        let input = body
            .content
            .into_iter()
            .find(|c| c.kind == "tool_use")
            .and_then(|c| c.input)
            .ok_or(LlmError::MissingContent)?;
        serde_json::from_value(input).map_err(LlmError::Json)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TutorReply;

    #[test]
    fn extract_json_strips_fences() {
        let out = extract_json("\u{0060}\u{0060}\u{0060}json\n{\"reply\":\"hola\"}\n\u{0060}\u{0060}\u{0060}");
        assert_eq!(out, "{\"reply\":\"hola\"}");
    }

    #[test]
    fn extract_json_extracts_object_from_prose() {
        let out = extract_json("Sure! Here you go: {\"reply\":\"hola\"} hope that helps");
        assert_eq!(out, "{\"reply\":\"hola\"}");
    }

    #[test]
    fn extract_json_passes_through_plain_json() {
        let out = extract_json("{\"reply\":\"hola\"}");
        assert_eq!(out, "{\"reply\":\"hola\"}");
    }

    #[test]
    fn parse_tool_use_input() {
        let body: AnthropicResponse = serde_json::from_value(serde_json::json!({
            "content": [{"type": "tool_use", "id": "x", "name": "Analysis", "input": {"tokens": []}}]
        }))
        .unwrap();
        let input = body
            .content
            .into_iter()
            .find(|c| c.kind == "tool_use")
            .and_then(|c| c.input)
            .unwrap();
        assert_eq!(input["tokens"].as_array().unwrap().len(), 0);
    }

    #[test]
    fn build_anthropic_request_injects_schema() {
        let req = build_anthropic_request::<TutorReply>("claude-x", "You are a tutor.", "TutorReply");
        assert_eq!(req["model"], "claude-x");
        assert_eq!(req["messages"][0]["role"], "user");
        let system = req["system"].as_str().unwrap();
        assert!(system.contains("You are a tutor."));
        assert!(system.contains("TutorReply"));
        assert!(system.contains("properties"));
    }
}
