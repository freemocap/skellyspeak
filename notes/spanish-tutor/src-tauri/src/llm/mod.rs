//! Pluggable LLM backend (the "strategy" pattern from skellysubs).
//! Ollama is the default local backend; swap in llama.cpp bindings or a remote
//! client by implementing this trait.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

pub mod ollama;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String, // "system" | "user" | "assistant"
    pub content: String,
}

impl ChatMessage {
    pub fn system(c: impl Into<String>) -> Self { Self { role: "system".into(), content: c.into() } }
    pub fn user(c: impl Into<String>) -> Self { Self { role: "user".into(), content: c.into() } }
    pub fn assistant(c: impl Into<String>) -> Self { Self { role: "assistant".into(), content: c.into() } }
}

#[async_trait]
pub trait LlmClient: Send + Sync {
    /// Free-form chat turn (used for the conversation).
    async fn chat(&self, messages: &[ChatMessage]) -> anyhow::Result<String>;
    /// Strict-JSON completion (used by the analyzer). Temperature 0.
    async fn complete_json(&self, system: &str, user: &str) -> anyhow::Result<String>;
}
