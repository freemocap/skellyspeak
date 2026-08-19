use super::{ChatMessage, LlmClient};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Talks to a local Ollama server (default http://localhost:11434).
pub struct OllamaClient {
    base_url: String,
    model: String,
    http: reqwest::Client,
}

impl OllamaClient {
    pub fn new(base_url: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            model: model.into(),
            http: reqwest::Client::new(),
        }
    }
}

#[derive(Serialize)]
struct ChatReq<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    stream: bool,
    options: Options,
    #[serde(skip_serializing_if = "Option::is_none")]
    format: Option<&'a str>,
}

#[derive(Serialize)]
struct Options {
    temperature: f32,
}

#[derive(Deserialize)]
struct ChatResp {
    message: RespMsg,
}

#[derive(Deserialize)]
struct RespMsg {
    content: String,
}

#[async_trait]
impl LlmClient for OllamaClient {
    async fn chat(&self, messages: &[ChatMessage]) -> anyhow::Result<String> {
        let req = ChatReq {
            model: &self.model,
            messages,
            stream: false,
            options: Options { temperature: 0.7 },
            format: None,
        };
        let resp: ChatResp = self
            .http
            .post(format!("{}/api/chat", self.base_url))
            .json(&req)
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        Ok(resp.message.content)
    }

    async fn complete_json(&self, system: &str, user: &str) -> anyhow::Result<String> {
        let messages = vec![ChatMessage::system(system), ChatMessage::user(user)];
        let req = ChatReq {
            model: &self.model,
            messages: &messages,
            stream: false,
            options: Options { temperature: 0.0 },
            format: Some("json"), // Ollama JSON mode
        };
        let resp: ChatResp = self
            .http
            .post(format!("{}/api/chat", self.base_url))
            .json(&req)
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        Ok(resp.message.content)
    }
}
