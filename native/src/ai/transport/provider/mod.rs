mod keys;
mod payload;
mod request;
mod response;

pub use keys::{validate_key_format, verify_key};
pub use payload::{
    GLOSS_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS, RequestOutput, dispatch_payload, payload, payload_with_output,
};
pub use request::{client, complete, complete_streaming, complete_with_output};
pub use response::{decode, strip_prose_emojis, validate_prose};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptMessage {
    pub role: String,
    pub content: String,
}
#[derive(Debug)]
pub struct Completion {
    pub diagnostics: Option<serde_json::Value>,
    pub text: String,
    pub finish_reason: String,
    pub actual_model: String,
    pub provider_id: String,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
}

#[cfg(test)]
#[path = "tests/fixtures.rs"]
mod fixtures;
