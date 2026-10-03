//! Native reconstruction of bounded provider frames; server frames are not prose.
use crate::model::{AppError, ErrorCode, Result};
use serde_json::{Value, json};

#[derive(Default)]
pub(crate) struct Stream {
    pub frames: Vec<Value>,
    pub text: String,
    bytes: usize,
}
impl Stream {
    pub fn push(&mut self, frame: Value) -> Result<()> {
        self.bytes += serde_json::to_vec(&frame)?.len();
        if self.bytes > 4 * 1024 * 1024 || !frame.is_object() {
            return Err(AppError::new(
                ErrorCode::Provider,
                "Provider stream exceeds its bounded frame contract.",
            ));
        }
        if let Some(text) = frame
            .pointer("/choices/0/delta/content")
            .and_then(Value::as_str)
        {
            if self.text.len() + text.len() > 262144 {
                return Err(AppError::new(
                    ErrorCode::Provider,
                    "Provider stream text exceeds its limit.",
                ));
            }
            self.text.push_str(text);
        }
        self.frames.push(frame);
        Ok(())
    }
    pub fn completion(&self, receipt: &Value) -> Result<super::Completion> {
        let mut value = receipt.clone();
        let mut choice = json!({"message":{"content":self.text}});
        for frame in &self.frames {
            if let Some(object) = frame["choices"][0].as_object() {
                for key in ["finish_reason", "native_finish_reason", "error"] {
                    if let Some(v) = object.get(key).filter(|v| !v.is_null()) {
                        choice[key] = v.clone();
                    }
                }
            }
        }
        value["choices"] = json!([choice]);
        value["provider_frames"] = json!(self.frames);
        super::decode(&serde_json::to_vec(&value)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn role_frames_usage_and_truncated_content_reconstruct_locally() {
        let mut stream = Stream::default();
        for frame in [
            json!({"choices":[{"delta":{"role":"assistant"}}]}),
            json!({"choices":[{"delta":{"content":"¡Hola "}}],"new_field":{"count":3}}),
            json!({"choices":[{"delta":{"content":"世界"},"finish_reason":"length","native_finish_reason":"MAX_TOKENS"}]}),
            json!({"choices":[],"usage":{"total_tokens":7}}),
        ] {
            stream.push(frame).unwrap();
        }
        assert_eq!(stream.text, "¡Hola 世界");
        assert_eq!(stream.frames.len(), 4);
        let result = stream
            .completion(&json!({"id":"r","model":"m","stream_complete":true,
            "usage":{"prompt_tokens":4,"completion_tokens":3,"total_tokens":7}}))
            .unwrap();
        assert_eq!(result.text, "¡Hola 世界");
        assert_eq!(result.finish_reason, "length");
    }
}
