//! Captured request inputs and ordered prompt composition.
use serde::Serialize;
use crate::prompts::difficulty::Difficulty;

#[derive(Debug, Clone, Serialize)]
pub struct Context {
    pub chat_id: String,
    pub message_id: Option<u64>,
    pub replaces_message_id: Option<u64>,
    pub trigger: String,
    pub target: String,
    pub native: String,
    pub dialect: String,
    pub provider_mode: String,
    pub difficulty: Difficulty,
    pub inferred_level_notes: String,
    pub topic: Option<String>,
    pub lesson_revision: u64,
    pub partner: serde_json::Value,
    pub history_messages: usize,
    pub history_available: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct Block {
    pub id: String,
    pub source: String,
    pub content: String,
}
impl Block {
    pub fn new(id: &str, source: &str, content: String) -> Self {
        Self { id: id.into(), source: source.into(), content }
    }
}
pub fn render(blocks: &[Block]) -> String {
    blocks.iter().filter(|block| !block.content.is_empty()).map(|block| block.content.as_str()).collect::<Vec<_>>().join("\n\n")
}

#[derive(Debug, Clone, Serialize)]
pub struct Message {
    pub role: String,
    pub content: String,
    pub truncated: bool,
}
#[derive(Debug, Clone, Serialize)]
pub struct Request {
    pub messages: Vec<Message>,
    pub parameters: serde_json::Value,
    pub route: String,
    pub blocks: Vec<Block>,
    pub truncated: bool,
}
impl Request {
    /// Only outbound text/parameter fields; never accepts headers or credentials.
    pub fn capture(payload: &serde_json::Value, route: &str, blocks: &[Block]) -> Self {
        let mut remaining = 24_000;
        let messages: Vec<Message> = payload["messages"].as_array().expect("request messages").iter().map(|m| {
            let raw = m["content"].as_str().expect("text message");
            let content: String = raw.chars().take(remaining).collect();
            remaining -= content.chars().count();
            Message { role: m["role"].as_str().expect("message role").into(), truncated: content.len() != raw.len(), content }
        }).collect();
        let mut parameters = serde_json::Map::new();
        for key in ["model", "temperature", "max_tokens", "stream", "reasoning", "response_format", "provider"] {
            if let Some(value) = payload.get(key) { parameters.insert(key.into(), value.clone()); }
        }
        let mut clipped = messages.iter().any(|m| m.truncated);
        let mut block_budget = 24_000;
        let blocks: Vec<Block> = blocks.iter().map(|b| {
            let content: String = b.content.chars().take(block_budget).collect();
            block_budget -= content.chars().count();
            clipped |= content.len() != b.content.len();
            Block::new(&b.id, &b.source, content)
        }).collect();
        let blocks = if blocks.is_empty() {
            messages.iter().enumerate().filter(|(_, m)| m.role == "system").map(|(i, m)| Block::new(&format!("system_message_{i}"), "captured outbound system message", m.content.clone())).collect()
        } else { blocks };
        Self { messages, parameters: parameters.into(), route: route.into(), blocks, truncated: clipped }
    }
}
